# Conductor Chord [![Build Status](https://travis-ci.org/FelixMcFelix/conductor-chord.svg)](https://travis-ci.org/FelixMcFelix/conductor-chord) [![Code Climate](https://codeclimate.com/github/FelixMcFelix/conductor-chord/badges/gpa.svg)](https://codeclimate.com/github/FelixMcFelix/conductor-chord)
An ES6 Chord implementation with extensible message delivery, built with WebRTC-Conductor.

## Overview

### Standard Usage

If you only need a standard chord implementation, then usage could not be simpler. The following source code will create a client (assuming execution in the browser).

```javascript
let Chord = require("conductor-chord").Chord;

window.c = new Chord({
  // The debug flag will produce additional console output.
  // Do not use in production environments!
	debug: true
});

c.join("ws://yourserver.me:7171")
  .then(() => {
    /* Do some stuff! */
    c.on("connect", () => {/* Do Something */})
    c.on("lowConnection", () => {/* Do Something */})
    c.on("disconnect", () => {/* Do Something Else*/})
    c.on("fileAdded", (key, value) => {/* Handle the data that this node has been tasked with storing */})
  });
```
And to run your own server, assuming a suitable WebRTC implementation for Node.js.
```javascript
const Chord = require("conductor-chord").Chord,
	wrtc = require("wrtc");
	
// NOTE: until wrtc accepts the Promise API, please use
// https://github.com/FelixMcFelix/node-webrtc

let c = new Chord({
  // This additional configuration for conductor may be used to produce client-side
  // chord based applications in Node.js, if needed.
	conductorConfig: {
		rtc_facade: wrtc
	},

	isServer: true,
	
	debug: true
});
```

Chiefly, the module offers item storage across the network. Presently, items are not replicated across the network due to ownership concerns but this may appear in future versions. To use the default functionality:

```javascript
// Join an existing network with a known WebSocket address.
c.join(addr);

// FileStore calls typically return these codes:
//  STORE_OKAY = 0,
//	FILE_EXISTS = 1,
//	BAD_UPDATE = 2,
//	UPDATE_OKAY = 4,
//	NO_FILE = 5,
//	KEEPALIVE_OKAY = 6;

// Add an item into the network with a string key, and JSON representable value.
// Returns {code: STORE_OKAY | FILE_EXISTS}
c.addItem(key, value);

// Look up an item, given a string key.
// Returns value | null
c.lookupItem(key);

// Update an item, given a key and new value. May fail, if this node does not own the item
// or no such item exists.
// Returns {code: BAD_UPDATE | UPDATE_OKAY | NO_FILE}
c.updateItem(key, value);

// Drop an item, given a string based key.
// Unfriendly call for now - very little feedback.
c.dropItem(key);
```
### Extension

This variant of chord can be extended with any supporting modules by plugging into its base message delegation system.

```javascript
// Register a new module to a chord object, c.
c.registerModule(module);

// Modules should have at least the following:
class GenericModule {

  constructor (chord) {
    //Name of your module, used to hand over messages from Chord.
    this.id = "module_name";
    
    this.chord = chord;
  }

  delegate (message) {
    // A message's handler property is intrinsic.
    switch (message.handler) {
    
      //...
      case "example":
        // Acting on a message's data.
        alert(message.data);
        
        // Ignore a message, if we are certain that it is not for this client.
        if (notAGoodMessage)
          message.pass();
        
        // Reply to a message, should we need to. This will allow the system
        // to route back through any proxies taken.
        else {
          let newMsg = this.chord.newMessage(module, handler, data, dest);
          message.reply(newMsg)
        }
        
        // Simplified syntax for sending a message to any node:
        this.chord.sendNewMessage(module, handler, data, dest)
        
        break;
    }
  }
  
}
```

You may wish to make use of the provided RemoteCallable class, designed around providing a reliable platform for modules based on RPC. The following example should demonstrate most points concerning their usage.

```javascript
const RemoteCallable = require("conductor-chord").RemoteCallable;

class EchoRPC extends RemoteCallable {
  constructor (chord) {
    // Call the super constructor with the module's name and a reference to the Chord object.
    super(chord, "EchoRPC");

    // Use these times to configure your module's guarantees, if needed.
    // Times are given in milliseconds.
    this._rcTimeout = 1000;
    this._rcRetries = 3;
    this._rcCacheDuration = 10000;

    // Register as per usual.
    chord.registerModule(this);
  }

  delegate (message) {
    // Necessary to catch handlers used on the backend.
    // Make sure that none of your handlers are called "answer"
    // or "error".
    if(super.delegate(message))
      return;

    switch (message.handler) {
      //...
      case "aThing":
        this._thing(message.data.params)
        break;
      //...
    }
  }

  doAThing (param1, param2) {
    // To make calls, use this syntax.
    // This should be abstracted behind named calls, like this one.

    // Dest may be calculated, or input as a parameter... so long as it can be converted into an ID.
    let dest = /*...*/;

    // Params whould be wrapped as an array at all times.
    return this.call(dest, "aThing", [param1, param2]);
  }
}
```

## Changelog

### 1.1.1
* Error types returned over RemoteCallable are now cast to string before JSON-stringifying.

### 1.1.0
* Now exposes RemoteCallable, ID classes to users of the module.
* Adds .dropItem(key) onto Chord items.
* Adds .on("evtName", fn) method to handle events. Currently, will emit "fileAdded", "connect", "disconnect", "lowConnection".

### 1.0.0
* Initial release.
