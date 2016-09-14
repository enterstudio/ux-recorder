'use strict';

/* global chrome */

class UxBackground {
  execute(tab) {
    if (!tab) {
      throw new Error('The tab is not defined.');
    }
    this.tab = tab;
    this._inject()
    .then(() => {
      let message = {
        'payload': 'initialize'
      };
      chrome.tabs.sendMessage(this.tab.id, message);
    });
  }

  _inject() {
    return new Promise((resolve) => {
      let opts = {
        file: 'js/cs.js'
      };
      chrome.tabs.executeScript(this.tab.id, opts, () => {
        opts = {
          file: 'styles/cs.css'
        };
        chrome.tabs.insertCSS(this.tab.id, opts, () => {
          resolve();
        });
      });
    });
  }

  _onConnected(port) {
    this.port = port;
    this.port.onMessage.addListener(this._onPortMessage.bind(this));
  }

  _onPortMessage(message) {
    if(!message || !message.payload) {
      return;
    }
    switch (message.payload) {
      case 'init-recording':
        this.chooseStream();
      break;
    }
  }

  chooseStream() {
    chrome.desktopCapture.chooseDesktopMedia(['tab', 'window'],
      this.tab, (streamId) => {
        let opt = {
          'payload': 'stream-selection'
        };
        if (!streamId) {
          opt.canceled = true;
          this.port.postMessage(opt);
          return;
        }
        opt.streamId = streamId;
        this.port.postMessage(opt);
    });
  }

  stopRecording() {
    if (!this.port) {
      console.warn('Port do not exist!');
      return;
    }
    let opt = {
      'payload': 'stop-recording'
    };
    this.port.postMessage(opt);
  }
}
var script;
chrome.browserAction.onClicked.addListener((tab) => {
  if (script) {
    console.log('Script is already running.');
    script.stopRecording();
    return;
  }
  script = new UxBackground();
  script.execute(tab);
  chrome.runtime.onConnect.addListener((port) => {
    script._onConnected(port);
  });
});
