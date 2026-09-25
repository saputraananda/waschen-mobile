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
    "revision": "6a53ac27f0e5e0f942723254cb85eab3"
  }, {
    "url": "assets/wib-CeU2UH6I.js",
    "revision": null
  }, {
    "url": "assets/webauthn-l0sNRNKZ.js",
    "revision": null
  }, {
    "url": "assets/vendor-CQI7a1l-.js",
    "revision": null
  }, {
    "url": "assets/scanner-DkfLi4Yi.js",
    "revision": null
  }, {
    "url": "assets/react-vendor-BfEhFXMG.js",
    "revision": null
  }, {
    "url": "assets/index-ZoScdTmK.js",
    "revision": null
  }, {
    "url": "assets/index-DzLN__Pd.js",
    "revision": null
  }, {
    "url": "assets/index-DsC6xYg9.js",
    "revision": null
  }, {
    "url": "assets/index-DIz1xdpm.js",
    "revision": null
  }, {
    "url": "assets/index-DBMh38FO.js",
    "revision": null
  }, {
    "url": "assets/index-CZF1clxG.js",
    "revision": null
  }, {
    "url": "assets/index-Cz28fjtv.js",
    "revision": null
  }, {
    "url": "assets/index-CWaG7Jh9.css",
    "revision": null
  }, {
    "url": "assets/index-Ck8lzMmm.js",
    "revision": null
  }, {
    "url": "assets/index-CIRDFKfF.js",
    "revision": null
  }, {
    "url": "assets/index-CbIs2-qE.js",
    "revision": null
  }, {
    "url": "assets/icons-BjV5Jq63.js",
    "revision": null
  }, {
    "url": "assets/EditProfile-CRsD2qM_.js",
    "revision": null
  }, {
    "url": "assets/CameraCaptureModal-D0_k53bG.js",
    "revision": null
  }, {
    "url": "assets/BarcodeScannerModal-C2z_BB55.js",
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
