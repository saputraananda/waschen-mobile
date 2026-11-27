/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-7e5eb42b'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "index.html",
    "revision": "af254061805f8deb8b7dcd4a8c84dd5d"
  }, {
    "url": "assets/wib-CeU2UH6I.js",
    "revision": null
  }, {
    "url": "assets/webauthn-l0sNRNKZ.js",
    "revision": null
  }, {
    "url": "assets/vendor-BUOIucNs.js",
    "revision": null
  }, {
    "url": "assets/TrainingDetail-3TzdURDh.js",
    "revision": null
  }, {
    "url": "assets/TestPage-eMA7Ubo8.js",
    "revision": null
  }, {
    "url": "assets/ScoreButtons-CidBMMBA.js",
    "revision": null
  }, {
    "url": "assets/scanner-ca9zSWah.js",
    "revision": null
  }, {
    "url": "assets/Sales-MYdMpJ6J.js",
    "revision": null
  }, {
    "url": "assets/react-vendor-CqaKXY98.js",
    "revision": null
  }, {
    "url": "assets/Progress-UtCkGZ7A.js",
    "revision": null
  }, {
    "url": "assets/PeriodPicker-CDxaBFzI.js",
    "revision": null
  }, {
    "url": "assets/OjtObserve-vlm4wv0m.js",
    "revision": null
  }, {
    "url": "assets/MentorScore-C5t0ELAU.js",
    "revision": null
  }, {
    "url": "assets/MentorBatch-BNmNJUC4.js",
    "revision": null
  }, {
    "url": "assets/index-pIPrtf0W.js",
    "revision": null
  }, {
    "url": "assets/index-jqNGi1HQ.js",
    "revision": null
  }, {
    "url": "assets/index-JFmpK4dJ.js",
    "revision": null
  }, {
    "url": "assets/index-g5e-8P8s.js",
    "revision": null
  }, {
    "url": "assets/index-DFpebIAU.js",
    "revision": null
  }, {
    "url": "assets/index-DdN3Y05M.css",
    "revision": null
  }, {
    "url": "assets/index-BrreBp7q.js",
    "revision": null
  }, {
    "url": "assets/index-BqCh4QoV.js",
    "revision": null
  }, {
    "url": "assets/index-BKuX9M5x.js",
    "revision": null
  }, {
    "url": "assets/index-BjL79_xP.js",
    "revision": null
  }, {
    "url": "assets/index-BibZi0ZM.js",
    "revision": null
  }, {
    "url": "assets/index-BbNFncM2.js",
    "revision": null
  }, {
    "url": "assets/index-8R8akr83.js",
    "revision": null
  }, {
    "url": "assets/index-1rGOvncf.js",
    "revision": null
  }, {
    "url": "assets/index-0O1xpnHO.js",
    "revision": null
  }, {
    "url": "assets/icons-M8s84Ubu.js",
    "revision": null
  }, {
    "url": "assets/FeedbackPage-C1qypkdQ.js",
    "revision": null
  }, {
    "url": "assets/Employee-Cro4mKcC.js",
    "revision": null
  }, {
    "url": "assets/EditProfile-J6loI2bT.js",
    "revision": null
  }, {
    "url": "assets/CameraCaptureModal-DcRcVJCV.js",
    "revision": null
  }, {
    "url": "assets/BarcodeScannerModal-fOxcoRQx.js",
    "revision": null
  }, {
    "url": "assets/AnswerReview-DrFvTWTP.js",
    "revision": null
  }, {
    "url": "assets/academyShared-zuvjGU0C.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "8ecca51449f7510fe0f28c70089b66bc"
  }, {
    "url": "favicon.png",
    "revision": "880d1bfe4ffeb1533327a300ec6645b4"
  }, {
    "url": "pwa-192x192.png",
    "revision": "afab75761a95e874019cf1a9b78c7d8a"
  }, {
    "url": "pwa-256x256.png",
    "revision": "0fb752437ef00a4717ecc83aac7cba39"
  }, {
    "url": "pwa-512x512.png",
    "revision": "47938f588f3ee04262c4bcacb9c89f69"
  }, {
    "url": "waschen.png",
    "revision": "7ba5cd299befd55f810b5c18d073ea67"
  }, {
    "url": "waschen.webp",
    "revision": "797f8412af5644d75d854c5387a382b2"
  }, {
    "url": "manifest.webmanifest",
    "revision": "9e3f368762c05e19ffe3bfd5f37ae8ed"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api/, /^\/uploads/]
  }));

}));
