# InterSystems IRIS Package Manager

This extension works with the [InterSystems Server Manager](https://marketplace.visualstudio.com/items?itemName=intersystems-community.servermanager) extension to manage IPM / ZPM packages on servers.

## Use

1. In Server Manager expand the Namespaces folder of the IRIS server **(2023.2 or later)** where you want to manage packages.
2. Use the new Package Manager action button on the row of the namespace you want to work in. The first time you do this for a server you will be prompted to permit this extension to use the server credentials. Approve this.
3. In the IPM tab that appears in the editor area use the command input field. The output of your IPM command displays in the textarea below.

A few IPM commands prompt for user input, in which case enter this in the same field you ran the command from.

This extension uses the InterSystems Lite Terminal's REST endpoint and websocket mechanism. Information [here](https://docs.intersystems.com/components/csp/docbook/DocBook.UI.Page.cls?KEY=GVSCO_debug#GVSCO_debug_websocket_debug) can help to debug in situations where Lite Terminal isn't working.

## Known Issues

1. License starvation has been observed and is being investigated.
2. May not respond gracefully if IPM not already installed on server.

## Release Notes

See the [CHANGELOG](CHANGELOG.md) for changes in each release.

## About George James Software

Known for our expertise in InterSystems technologies, George James Software has been providing innovative software solutions for over 35 years. We focus on activities that can help our customers with the support and maintenance of their systems and applications. Our activities include consulting, training, support, and developer tools - with Deltanji source control being our flagship tool. Our tools augment InterSystems' technology and can help customers with the maintainability and supportability of their applications over the long term. 

To find out more, go to our website - [georgejames.com](https://georgejames.com)
