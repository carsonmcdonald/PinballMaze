var gamejs = require('gamejs');
var box2d = require('./Box2dWeb-2.1.a.3');
var vectors = require('gamejs/utils/vectors');
var math = require('gamejs/utils/math');

var SCALE = 15;

/**
 * Calls the given handler with the x, y, z orentiation in degrees
 */
function orientationSetup(isMozilla, deviceOrientationHandler) 
{
  if ((window.DeviceMotionEvent) || ('listenForDeviceMovement' in window)) 
  {
    window.addEventListener('devicemotion', function(eventData) {
      var acceleration = eventData.accelerationIncludingGravity;

      // Z is the acceleration in the Z axis, and tells us if the device is facing up, or down
      var facingUp = -1;
      if (acceleration.z > 0) {
        facingUp = +1;
      }

      if(isMozilla) {
        deviceOrientationHandler( Math.round(acceleration.x * -90),
                                  Math.round(acceleration.y * 90) - 90,
                                  acceleration.z);
      } else {
        // Convert the value from acceleration to degress
        //   acceleration.x|y is the acceleration according to gravity, we'll assume we're on Earth and divide 
        //   by 9.81 (earth gravity) to get a percentage value, and then multiply that by 90 to convert to degrees.
        deviceOrientationHandler( Math.round((acceleration.x / 9.81) * -90),
                                  Math.round(((acceleration.y + 9.81) / 9.81) * 90 * facingUp),
                                  acceleration.z);
      }
    }, false);
  }
  else if (window.DeviceOrientationEvent) 
  {
    window.addEventListener('deviceorientation', function(eventData) {
      deviceOrientationHandler(-eventData.gamma, eventData.beta - 90, eventData.alpha);
    }, false);
  } 
  else 
  {
    return false;
  }
  return true;
}

/**
 * Defines a solid box with Box2D information
 */
var SolidBox = function(world, x, y, width, height)
{
  var bdef = new box2d.b2BodyDef();
  bdef.position = new box2d.b2Vec2(x, y);
  bdef.angle = 0;
  bdef.fixedRotation = true;
  this.body = world.CreateBody(bdef);

  var fixdef = new box2d.b2FixtureDef;
  fixdef.shape = new box2d.b2PolygonShape();
  fixdef.shape.SetAsBox(width/2, height/2);
  fixdef.restitution = 0.4;
  this.body.CreateFixture(fixdef);

  return this;  
};

/**
 * Defines the Pinball as a Sprite that holds Box2D data
 */
var Pinball = function(world, x, y, scale)
{
  Pinball.superConstructor.apply(this, arguments);

  this.startX = x;
  this.startY = y;

  this.image = gamejs.image.load("public/sphere.png");
  var imageSize = this.image.getSize();
  this.rect = new gamejs.Rect([x, y], [imageSize[0] * scale, imageSize[1] * scale]);
  this.size = 1.9 * scale;

  var bdef = new box2d.b2BodyDef();
  bdef.type = box2d.b2Body.b2_dynamicBody;
  bdef.position = new box2d.b2Vec2(x, y);
  bdef.angle = 0;
  bdef.linearDamping = 0.15; // the ball won't roll forever without force
  bdef.angularDamping = 0.9;
  bdef.bullet = true;
  this.body = world.CreateBody(bdef);

  var fixdef = new box2d.b2FixtureDef;
  fixdef.density = 5.0;
  fixdef.friction = 0.3;
  fixdef.restitution = 0.4;
  fixdef.shape = new box2d.b2CircleShape(this.size);
  this.ficture = this.body.CreateFixture(fixdef);

  return this;
};

gamejs.utils.objects.extend(Pinball, gamejs.sprite.Sprite);

Pinball.prototype.update = function(msDuration)
{
  var pos = this.body.GetPosition();
  this.rect.left = (pos.x-this.size-0.2) * SCALE;
  this.rect.top = (pos.y-this.size-0.2) * SCALE;
};

Pinball.prototype.hide = function()
{
  this._alive = false;
};

Pinball.prototype.reset = function()
{
  this.body.SetPosition(new box2d.b2Vec2(this.startX, this.startY));
  this._alive = true;
};

/**
 * Defines a hole with Box2D information
 */
var Hole = function(world, x, y, scale)
{
  var bdef = new box2d.b2BodyDef();
  bdef.position = new box2d.b2Vec2(x, y);
  bdef.angularDamping = 0.9;
  bdef.fixedRotation = true;
  this.body = world.CreateBody(bdef);
  this.size = 1.5 * scale;

  var fixdef = new box2d.b2FixtureDef;
  fixdef.density = 1.0;
  fixdef.friction = 0.0;
  fixdef.restitution = 0.0;
  fixdef.shape = new box2d.b2CircleShape(this.size); 
  this.body.CreateFixture(fixdef);

  return this;
};

// Set debug to true to see on screen information, 
// remove the background image to see Box2D outlines
var debug = false;

var gravityX = 0;
var gravityY = 0;

/**
 * This function setups up and runs the game engine.
 */
function main()
{
  var workingWidth = window.innerWidth > 768 ? 768 : window.innerWidth;
  var workingHeight = window.innerHeight > 1024 ? 1024 : window.innerHeight;

  if(workingWidth < 640) workingWidth = 640;
  if(workingHeight < 480) workingHeight = 480;

  $('#gjs-canvas').css({'padding-left':((window.innerWidth-workingWidth)/2) + 'px',
                        'padding-top':((window.innerHeight-workingHeight)/2) + 'px'});

  var scaledWidth = workingWidth/SCALE;
  var scaledHeight = workingHeight/SCALE;

  // Create the game display
  var display = gamejs.display.setMode([workingWidth, workingHeight]);

  // Load the background sprite and some message sprites for the game
  var backgroundImage = new gamejs.sprite.Sprite();
  backgroundImage.image = gamejs.image.load("public/background.png");
  backgroundImage.rect = new gamejs.Rect([0, 0], [workingWidth, workingHeight]);

  var lostImage = new gamejs.sprite.Sprite();
  lostImage.image = gamejs.image.load("public/golost.png");
  lostImage.rect = new gamejs.Rect([(workingWidth/2)-100, (workingHeight/2)-100], [200, 200]);

  var wonImage = new gamejs.sprite.Sprite();
  wonImage.image = gamejs.image.load("public/gowon.png");
  wonImage.rect = new gamejs.Rect([(workingWidth/2)-100, (workingHeight/2)-100], [200, 200]);
    
  var noordImage = new gamejs.sprite.Sprite();
  noordImage.image = gamejs.image.load("public/noord.png");
  noordImage.rect = new gamejs.Rect([(workingWidth/2)-100, 10], [200, 20]);
    
  // Create the Box2D game world.
  var world = new box2d.b2World(new box2d.b2Vec2(0, 0), false);
    
  // When in debug mode show the Box2D body outlines
  if(debug)
  {
    var debugDraw = new box2d.b2DebugDraw();
    debugDraw.SetSprite(display._canvas.getContext("2d"));
    debugDraw.SetDrawScale(SCALE);
    debugDraw.SetFillAlpha(0.5);
    debugDraw.SetLineThickness(1.0);
    debugDraw.SetFlags(box2d.b2DebugDraw.e_shapeBit);
    world.SetDebugDraw(debugDraw);
  }

  // The bounding area of the board and every wall inside the board
  var boundingArea = [];
    
  boundingArea.push(new SolidBox(world, scaledWidth/2, 0.5, scaledWidth, 1));
  boundingArea.push(new SolidBox(world, 0.5, scaledHeight/2, 1, scaledHeight-2));
  boundingArea.push(new SolidBox(world, scaledWidth/2, scaledHeight-0.5, scaledWidth, 1));
  boundingArea.push(new SolidBox(world, scaledWidth-0.5, scaledHeight/2, 1, scaledHeight-2));

  boundingArea.push(new SolidBox(world, scaledWidth * 0.12, scaledHeight * 0.20, scaledWidth * 0.20, 1));
  boundingArea.push(new SolidBox(world, scaledWidth * 0.35, scaledHeight * 0.32, 1, scaledHeight * 0.60));
  boundingArea.push(new SolidBox(world, scaledWidth * 0.24, scaledHeight * 0.61, scaledWidth * 0.20, 1));
  boundingArea.push(new SolidBox(world, scaledWidth * 0.27, scaledHeight * 0.80, scaledWidth * 0.50, 1));
  boundingArea.push(new SolidBox(world, scaledWidth * 0.53, scaledHeight * 0.58, 1, scaledHeight * 0.60));
  boundingArea.push(new SolidBox(world, scaledWidth * 0.67, scaledHeight * 0.27, scaledWidth * 0.30, 1));
  boundingArea.push(new SolidBox(world, scaledWidth * 0.67, scaledHeight * 0.19, 1, scaledHeight * 0.15));
  boundingArea.push(new SolidBox(world, scaledWidth * 0.83, scaledHeight * 0.45, scaledWidth * 0.30, 1));
  boundingArea.push(new SolidBox(world, scaledWidth * 0.69, scaledHeight * 0.65, scaledWidth * 0.30, 1));
  boundingArea.push(new SolidBox(world, scaledWidth * 0.25, scaledHeight * 0.95, 1, scaledHeight * 0.07));

  // Define the pinball, holes and winning game area
  var workingScale = workingHeight > workingWidth ? workingWidth / workingHeight : workingHeight / workingWidth;

  var pinball = new Pinball(world, scaledWidth * 0.10, scaledHeight * 0.10, workingScale);

  var holes = [];
  holes.push(new Hole(world, scaledWidth * 0.11, scaledHeight * 0.28, workingScale));
  holes.push(new Hole(world, scaledWidth * 0.25, scaledHeight * 0.53, workingScale));
  holes.push(new Hole(world, scaledWidth * 0.44, scaledHeight * 0.09, workingScale));
  holes.push(new Hole(world, scaledWidth * 0.85, scaledHeight * 0.87, workingScale));

  var winHole = new Hole(world, scaledWidth * 0.12, scaledHeight * 0.89, workingScale * 1.5);

  var gameOver = null;

  // Set up a listener the detects the pinball hitting a hole or the winning area
  var contactListener = new box2d.Box2D.Dynamics.b2ContactListener();
  contactListener.BeginContact = function (contact) {
    if( (contact.GetFixtureA().GetBody() === pinball.body || contact.GetFixtureB().GetBody() === pinball.body) &&
        (contact.GetFixtureA().GetBody() === winHole.body || contact.GetFixtureB().GetBody() === winHole.body))
    {
      gameOver = 'win';
    }
    else 
    {
      for(i=0; i<holes.length; i++)
      {
        if( (contact.GetFixtureA().GetBody() === pinball.body || contact.GetFixtureB().GetBody() === pinball.body) &&
            (contact.GetFixtureA().GetBody() === holes[i].body || contact.GetFixtureB().GetBody() === holes[i].body))
        {
          gameOver = 'lost';
        }
      }
    }
  };
  world.SetContactListener(contactListener);

  // Add a touch event listener that will restart the game
  window.addEventListener('touchstart', function(event) {
    if(gameOver != null)
    {
      gravityX = 0;
      gravityY = 0;
      pinball.reset();
      gameOver = null;
    }
  }, false);

  // Do the setup needed to support orientation and motion changes
  var orientationSupport = true;
  if (!orientationSetup($.browser.mozilla, deviceMotionHandler)) 
  {
    orientationSupport = false;
  }
    
  //
  // This is the main game loop
  //
  var KEYS_DOWN={};
  function tick(duration) 
  {
    // Set up some keys in case someone wants to play without orientation support
    gamejs.event.get().forEach(function(event){
      if (event.type === gamejs.event.KEY_DOWN) KEYS_DOWN[event.key] = true;
      else if (event.type === gamejs.event.KEY_UP) KEYS_DOWN[event.key] = false;           
    });

    if(KEYS_DOWN[gamejs.event.K_UP] && gravityY < 10){
      gravityY = -2.5;
    }else if(KEYS_DOWN[gamejs.event.K_DOWN] && gravityY > -10){
      gravityY = 2.5; 
    }
        
    if(KEYS_DOWN[gamejs.event.K_RIGHT] && gravityX < 10){
      gravityX = -2.5;
    }else if(KEYS_DOWN[gamejs.event.K_LEFT] && gravityX > -10){
      gravityX = 2.5;
    }

    if(KEYS_DOWN[gamejs.event.K_SPACE] && gameOver != null){
      gravityX = 0;
      gravityY = 0;
      pinball.reset();
      gameOver = null;
    }

    // Set the current gravity of the Box2D world
    world.SetGravity( new box2d.b2Vec2(gravityX, gravityY) );

    // One click of the Box2D world
    world.Step(duration/1000, 10, 8);        
    world.ClearForces();
        
    if(debug)
    {
      world.DrawDebugData();
    }

    backgroundImage.draw(gamejs.display.getSurface());

    if(!pinball.isDead())
    {
      pinball.update(duration);
      pinball.draw(gamejs.display.getSurface());
    }

    if(gameOver != null)
    {
      if(gameOver == 'lost')
      {
        pinball.hide();
        lostImage.draw(gamejs.display.getSurface());
      }
      else
      {
        wonImage.draw(gamejs.display.getSurface());
      }
    }

    if(debug)
    {
      var font = new gamejs.font.Font('16px Sans-serif');
      display.blit(font.render('FPS: '+parseInt(1000/duration)), [25, 25]);
    }

    if(!orientationSupport)
    {
      noordImage.draw(gamejs.display.getSurface());
    }
  };

  // Set the game loop in motion at 30 frames per second
  gamejs.time.fpsCallback(tick, this, 30);
}

/**
 * This function generically handles device motion events for the game.
 */
function deviceMotionHandler(x, y, z) 
{
  // y will be 0 to -180 and x will be 90 to -90. Only care about a narrow range.
  if(y > -80) y = -80;
  if(y < -100) y = -100;

  gravityY = (90 + y) * 1;

  if(x > 10) x = 10;
  if(x < -10) x = -10;

  gravityX = x * -1;
} 

// Preload sprites and then start the engine
gamejs.preload(["public/background.png", "public/sphere.png", "public/golost.png", "public/gowon.png", "public/noord.png"]);
gamejs.ready(main);
