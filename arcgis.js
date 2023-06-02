var selectedGraphics = null;
var copiedGraphics = null;
var orientationTypes = {
    landScape: 'landScape',
    portrait: 'portrait'
};
var symbol = {
    type: "simple-fill",
    color: [0, 0, 0, 0.5],
    style: "solid",
    outline: {
        color: [0, 0, 0],
        width: 1
    }
};
var spatialReference = {
    wkid: 4326
};
// Create a new URLSearchParams object from the current URL's query string
var searchParams = new URLSearchParams(window.location.search);
// Get the value of the "searchTerm" parameter from the query string
const lat = searchParams.get("lat");
const lon = searchParams.get("lon");
var projectId = searchParams.get("id");
var projects = [];
debugger
var zoom = projectId ? 21 : 15;


// Use the search term to display search results or perform other actions
require([
    "esri/layers/WFSLayer",
    "esri/geometry/geometryEngine",
    "esri/widgets/Sketch/SketchViewModel",
    "esri/Map",
    "esri/layers/GraphicsLayer",
    "esri/views/MapView",
    "esri/views/SceneView",
    "esri/widgets/Expand",
    "esri/Graphic",
    "esri/layers/MapNotesLayer",
    "esri/geometry/Polygon",
    "esri/geometry/Polyline",
    "esri/widgets/Search",
    "esri/widgets/Zoom",
    "esri/geometry/support/webMercatorUtils",
    "esri/geometry/SpatialReference",
    "esri/geometry/Extent",
    "esri/geometry/Point"


], (
    WFSLayer,
    geometryEngine,
    SketchViewModel,
    Map,
    GraphicsLayer,
    MapView,
    SceneView,
    Expand,
    Graphic,
    MapNotesLayer,
    Polygon,
    Polyline,
    Search,
    Zoom,
    webMercatorUtils,
    SpatialReference,
    Extent,
    Point
) => {
    const graphicsLayer = new GraphicsLayer({
        spatialReference: { wkid: 4326 } // Set the spatial reference of the graphics layer
    });

    var wfsUrl = "https://geobretagne.fr/geoserver/ows"; // Replace with your WFS service URL
    var wfsLayer = new WFSLayer({
        url: wfsUrl,
        outFields: ["*"],
        popupTemplate: {
            title: "{attribute}", // Specify the title of the popup, using attribute values from the feature
            content: [
                {
                    type: "fields",
                    fieldInfos: [
                        {
                            fieldName: "field1", // Specify the field name
                            label: "Field 1" // Specify the field label to display in the popup
                        },
                        {
                            fieldName: "field2",
                            label: "Field 2"
                        },
                        // Add more fieldInfos for each field you want to display
                    ]
                }
            ]
        }
    });
    const textLayer = new MapNotesLayer().textLayer;
    const mapView = renderMap("viewDiv", lat || 40.022, lon || -105.255, zoom, "gray-vector");
    const searchWidget = setSearchWidget(lat, lon);
    const sketchVM = elementDrawerOnMapEventListner();
    mapView.map.add(textLayer);

    //Excuting Following statements after loading the map
    mapView.when(async () => {
        //  let projectId = getProjectId(lat,lon);
        if (projectId) {
            var data = await getData(projectId);
            if (data && data.summary_json) {
                loadExistingDataIntoMap(data.summary_json);
            }
        }
        setDefaultPolygonSymbol();
    });

    panelDragDropEventListner();

    function elementDrawerOnMapEventListner() {
        var sketchVM = new SketchViewModel({
            view: mapView,
            layer: graphicsLayer,
            spatialReference: new SpatialReference({ wkid: 4326 }),
            // disable the spatial reference synchronization
            synchronizationMode: "manual",
        });

        sketchVM.on("create", function (event) {
            searchWidget.clear();
            if (event.state === "complete") {
                if (event.tool == 'rectangle') {
                    var centerPoint = { latitude: event.graphic.geometry.extent.center.latitude, longitude: event.graphic.geometry.extent.center.longitude };
                    var latitudeDistance = 111132.92 - 559.82 * Math.cos(2 * centerPoint.latitude * Math.PI / 180) + 1.175 * Math.cos(4 * centerPoint.latitude * Math.PI / 180) - 0.0023 * Math.cos(6 * centerPoint.latitude * Math.PI / 180);
                    var longitudeDistance = 111320 * Math.cos(centerPoint.latitude * Math.PI / 180);
                    var width = event.graphic.geometry.extent.width;
                    var height = event.graphic.geometry.extent.height;;
                    var rings = createRings(centerPoint.longitude, centerPoint.latitude, latitudeDistance, longitudeDistance, height, width)
                    var outerPolygon = new Polygon({
                        rings: rings,
                        spatialReference: { wkid: 4326 }
                    });

                    let selectedGraphic = [];
                    graphicsLayer.graphics.forEach(x => {
                        if (x.geometry != null && x.uid != event.graphic.uid) {
                            let iscontain = geometryEngine.within(x.geometry, outerPolygon);
                            let iscontainWithspatialReference = geometryEngine.within(x.geometry, event.graphic.geometry);

                            if (iscontain || iscontainWithspatialReference) {
                                selectedGraphic.push(x);
                            }
                        }
                    });
                    if (selectedGraphic.length > 0) {
                        const newExtent = new Extent({
                            xmin: -122.5,
                            ymin: 37.5,
                            xmax: -122.0,
                            ymax: 38.0,
                            spatialReference: new SpatialReference({ wkid: 4326 }) // set the spatial reference of the new geometry to WKID 4326
                        });
                        sketchVM.update(selectedGraphic, {
                            mode: "move",
                            geometry: newExtent,
                            spatialReference: {
                                wkid: 4326
                            }
                        });
                        // Disable the SketchViewModel by calling its cancel method

                    }
                    graphicsLayer.remove(event.graphic);
                }
            }
            else {
                if (event.tool == 'polyline' && event.graphic != null) {
                    event.graphic.attributes = {
                        id: event.graphic.uid
                    }
                    if (event.graphic.geometry.paths[0].length > 2) {
                        var graphic = event.graphic;
                        var geometry = graphic.geometry;
                        var vertices = geometry.paths[0];
                        let polyline = {
                            type: "polyline",
                            paths: [[
                                event.graphic.geometry.paths[0][0],
                                event.graphic.geometry.paths[0][event.graphic.geometry.paths[0].length - 1]]
                            ],
                            spatialReference: {
                                wkid: 102100,
                            },
                        };
                        let meters = geometryEngine.geodesicLength(polyline, "meters");

                        if (meters < 1) {
                            sketchVM.complete();
                            vertices[vertices.length - 1] = vertices[0];
                            geometry.paths[0] = vertices;
                            graphic.geometry = geometry;
                        }
                    }
                    getPolyLineLength(event.graphic);
                    getRunTimeMeasureMent(event.graphic.geometry)
                }
            }
        });

        sketchVM.on("update", function (event) {

            if (event.state == 'active'
                && event.toolEventInfo &&
                (
                    (event.graphics.length == 1 && event.toolEventInfo?.type == 'reshape-start') ||
                    (event.graphics.length > 1 && (event.toolEventInfo?.type == 'scale-start' || event.toolEventInfo?.type == 'reshape-start'))
                )) {
                console.log(event.toolEventInfo?.type)
                sketchVM.complete();
            }
            searchWidget.clear();
            selectedGraphics = event.graphics;
            if (event.state === "complete") {
                let oldRotationAngle = event.graphics[0].getAttribute('rotationAngle');
                event.graphics.forEach(x => {
                    if (x.geometry.type == 'polygon' && x.geometry.rings.length > 0) {
                        x.attributes.latitude = x.geometry.extent.center.latitude
                        x.attributes.longitude = x.geometry.extent.center.longitude
                        x.attributes.rotationAngle = getRotationAngle(x.geometry);
                    }
                })
                if (!event.aborted && event.graphics.length == 1 && event.graphics[0].attributes && event.graphics[0].attributes.panelId) {
                    buildTool(event.graphics[0], oldRotationAngle)
                }
                if (event.aborted) {
                    deletePanel();
                }
                else {
                    event.graphics.forEach(x => {
                        if (x.symbol.type == 'simple-line') {
                            getPolyLineLength(x);
                        }
                    });
                }
            }
        });
        return sketchVM;
    }

    function renderMap(container, lat, lon, zoom, basemap) {

        // var mapView = new SceneView({
        //     container: container,
        //     map: new Map({
        //         basemap: basemap,
        //         layers: [wfsLayer, graphicsLayer],
        //         spatialReference: new SpatialReference({ wkid: 4326 })
        //     }),
        //     camera: {
        //         position: {
        //             latitude: lat,
        //             longitude: lon,
        //             z: zoom
        //         },
        //         tilt: 0, // Set the initial tilt of the camera if desired
        //         heading: 0 // Set the initial heading of the camera if desired
        //     },
        //     highlightOptions: {},
        //     // Add event listener for webglcontextlost event
        //     context: {
        //         webglContextLost: function (event) {
        //             console.warn("WebGL context lost. Attempting to recover...");
        //             event.preventDefault(); // Prevent the default context loss handling
        //             mapView.initialize();
        //         }
        //     }
        // });


        var mapView = new MapView({
            container: container,
            map: new Map({
                basemap: basemap,
                layers: [wfsLayer, graphicsLayer],
                spatialReference: new SpatialReference({ wkid: 4326 })
            }),
            center: [lon, lat],// lon, lat
            zoom: zoom,
            interactable: true,
            highlightOptions: {}
        });



        // mapView.on("webglcontextlost", function (event) {
        //     console.log("lost")
        //     event.preventDefault(); // Prevent the default behavior of the context loss

        //     // Recreate the WebGL context and restore resources
        //     mapView.container.removeChild(mapView.canvas); // Remove the existing canvas element
        //     mapView = null; // Clear the reference to the old view

        //     // Recreate the map view
        //     mapView = new SceneView({
        //         container: container,
        //         map: new Map({
        //             basemap: basemap,
        //             layers: [wfsLayer, graphicsLayer],
        //             spatialReference: new SpatialReference({ wkid: 4326 })
        //         }),
        //         camera: {
        //             position: {
        //                 latitude: lat,
        //                 longitude: lon,
        //                 z: zoom
        //             },
        //             tilt: 0, // Set the initial tilt of the camera if desired
        //             heading: 0 // Set the initial heading of the camera if desired
        //         },
        //         highlightOptions: {},
        //         // Add event listener for webglcontextlost event
        //         context: {
        //             webglContextLost: function (event) {
        //                 console.warn("WebGL context lost. Attempting to recover...");
        //                 event.preventDefault(); // Prevent the default context loss handling

        //                 // Implement your own recovery mechanism here
        //                 // For example, you can recreate the WebGL context and restore the state

        //                 // After recovering, reinitialize the SceneView
        //                 mapView.initialize();
        //             }
        //         }
        //     });

        //     // Re-add layers and restore other resources
        //     // ...

        //     // Refresh the view
        //     mapView.then(function () {
        //         // View has been restored
        //     });


        // });




        var zoom = new Zoom({
            view: mapView,
            position: "bottom-right"
        });

        mapView.ui.add(zoom, {
            position: "bottom-left"
        });
        mapView.ui.components = mapView.ui.components.filter(function (component) {
            return component !== "zoom";
        });
        if (propPanel) {
            var stylerExpand = new Expand({
                view: mapView,
                content: propPanel,
                expanded: true,
                expandIconClass: "esri-icon-edit",
                expandTooltip: "Open Styler"
            });
            mapView.ui.add(stylerExpand, "top-right");
            toolbarButtonClickEvents();

        }

        // Add the calcite panel
        mapView.ui.add(measurements, "manual");


        mapView.on("click", function (event) {
            var query = wfsLayer.createQuery();
            query.geometry = event.mapPoint;
            query.spatialRelationship = "intersects";
            query.returnGeometry = false;
            query.outFields = ["*"];

            wfsLayer.queryFeatures(query).then(function (results) {
                console.log(results)
                if (results.features.length > 0) {
                    var feature = results.features[0];
                    // Access the attributes of the clicked feature
                    var attributes = feature.attributes;
                    console.log(attributes);

                    // Set the attributes on the popup template
                    wfsLayer.popupTemplate.content = `
                    <h3>${attributes.roofName}</h3>
                    <p>Roof Area: ${attributes.area}</p>
                    <p>Roof Tilt: ${attributes.tilt}</p>
                  `;
                }
            });
        });

        // Check if the WFS layer is already loaded
        if (wfsLayer.loadStatus === "loaded") {
            console.log("WFS layer is already loaded");
        } else {
            console.log("WFS layer is not yet loaded");

            // Wait for the WFS layer to load
            wfsLayer.when(function () {
                console.log("WFS layer has finished loading");
            });
        }
        return mapView;
    }
    function setSearchWidget(lat, lon) {
        var searchWidget = new Search({
            view: mapView
        });
        // if (lat && lon) {
        //     searchWidget.viewModel.searchTerm = lat + " , " + lon;
        //     searchWidget.search();
        // }
        mapView.ui.add(searchWidget, {
            position: "top-left"
        });


        return searchWidget;
    }

    function setDefaultPolygonSymbol() {
        const polygonSymbol = sketchVM.polygonSymbol;
        polygonSymbol.color = [0, 0, 0, 0];
        polygonSymbol.outline.style = 'dash';
        polygonSymbol.outline.width = parseInt(1);
        polygonSymbol.outline.color = "green";
    }

    function loadExistingDataIntoMap(data) {
        data.Graphic.forEach(x => {
            if (x.geometry && x.geometry.rings?.length > 0) {
                var rectangle = new Polygon({
                    rings: x.geometry.rings,
                    spatialReference: x.geometry.spatialReference
                });
                var polygonGraphic = new Graphic({
                    geometry: rectangle,
                    symbol: symbol,
                    attributes: x.attributes
                });
                graphicsLayer.add(polygonGraphic)
            }
            else if (x.geometry && x.geometry.paths?.length > 0) {
                var line = new Polyline({
                    paths: x.geometry.paths,
                    spatialReference: x.geometry.spatialReference
                });
                var polylineGraphic = new Graphic({
                    geometry: line,
                    symbol: {
                        type: "simple-line",
                        color: [130, 130, 130, 255],
                        width: 2
                    },
                    attributes: x.attributes
                });
                graphicsLayer.add(polylineGraphic)
            }

        });

        data.TextGraphic.forEach(x => {
            var textGraphic = new Graphic({
                geometry: {
                    type: "point",
                    x: x.geometry.x,
                    y: x.geometry.y,
                    "spatialReference": x.geometry.spatialReference
                },
                symbol: {
                    type: "text",
                    text: x.symbol.text,
                    color: [255, 255, 255],
                    haloColor: [1, 68, 33],
                    haloSize: 2,
                    font: {
                        family: "Arial Unicode MS",
                        size: 14
                    }
                },
                attributes: x.attributes
            });
            textLayer.add(textGraphic)
        });

        renderDroppedPanelCount(data.Graphic);
    }


    function getRotationAngle(geometry) {
        let vertices = geometry.rings[0]; // Get the vertices of the polygon
        const x1 = vertices[0][0]; // Get the x-coordinate of the first vertex
        const y1 = vertices[0][1]; // Get the y-coordinate of the first vertex
        const x2 = vertices[1][0]; // Get the x-coordinate of the second vertex
        const y2 = vertices[1][1]; // Get the y-coordinate of the second vertex
        const deltaX = x2 - x1;
        const deltaY = y2 - y1;
        let rotationAngle = Math.atan2(deltaY, deltaX) * 180 / Math.PI; // Calculate the rotation angle in degrees
        return rotationAngle;
    }

    const getData = async (id) => {
        const response = await fetch(apiUrl + "/" + id, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
            }
        });
        const responseJson = await response.json();
        let records = responseJson;
        return records;
    };


    function toolbarButtonClickEvents() {
        if (polylineBtn)
            polylineBtn.onclick = () => { sketchVM.create("polyline"); }

        if (rectangleBtn)
            rectangleBtn.onclick = () => { sketchVM.create("rectangle"); }

        if (screenshotBtn)
            screenshotBtn.onclick = () => {
                mapView.takeScreenshot().then(screenshot => {
                    downloadImage("screenshot.png", screenshot.dataUrl)

                })

            }

        if (clearBtn)
            clearBtn.onclick = () => {
                deletePanel();
            }

        if (saveBtn)
            saveBtn.onclick = async () => {
                loader(true);

                var graphics = graphicsLayer.graphics.toArray();
                var textGraphic = textLayer.graphics.toArray();
                let count = graphics.filter(x => x.attributes && x.attributes.panelId).length
                let summaryJson = {
                    Graphic: graphics,
                    TextGraphic: textGraphic,
                }
                let panelName = ""; panelRecordid = "";
                if (graphics && graphics.length > 0) {
                    let graphic = graphics[0]
                    panelName = graphic.attributes.panel.field_47,
                        panelRecordid = graphic.attributes.panel.id
                    let longitude = graphic.geometry.extent.center.longitude;
                    let latitude = graphic.geometry.extent.center.latitude;
                    let point = new Point({
                        x: longitude,
                        y: latitude,
                        spatialReference: new SpatialReference({ wkid: 4326 }),
                    });
                    mapView.goTo({
                        target: point
                    }).then(function () {
                        mapView.takeScreenshot({ format: 'png', quality: 1 }).then(screenshot => {
                            let fileName = 'screenshot.png';
                            var blob = dataURItoBlob(screenshot.dataUrl)
                            let file = new File([blob], fileName, { type: blob.type });
                            save(summaryJson, count, panelName, panelRecordid, file)
                        })


                    })
                }
                else {
                    mapView.takeScreenshot({ format: "png" }).then(screenshot => {
                        let fileName = 'screenshot.png';
                        var blob = dataURItoBlob(screenshot.dataUrl)
                        let file = new File([blob], fileName, { type: blob.type });
                        save(summaryJson, count, panelName, panelRecordid, file)
                    })
                }
            }
        if (portraitLandscapeBtn)
            portraitLandscapeBtn.onclick = () => {
                rotateGraphics();
            }


    }

    function dataURItoBlob(dataURI) {
        // convert base64 to raw binary data held in a string
        // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
        var byteString = atob(dataURI.split(',')[1]);

        // separate out the mime component
        var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

        // write the bytes of the string to an ArrayBuffer
        var ab = new ArrayBuffer(byteString.length);
        var ia = new Uint8Array(ab);
        for (var i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }

        //Old Code
        //write the ArrayBuffer to a blob, and you're done
        //var bb = new BlobBuilder();
        //bb.append(ab);
        //return bb.getBlob(mimeString);

        //New Code
        return new Blob([ab], { type: mimeString });


    }

    async function save(summaryJson, count, panelName, panelRecordid, file) {
        var formData = new FormData();
        formData.append("summary_json", JSON.stringify(summaryJson));
        formData.append("latitude", lat);
        formData.append("longitude", lon);
        formData.append("created_at", new Date().getTime());
        formData.append("qty_panels", count);
        formData.append("panel_name", panelName);
        formData.append("record_id", panelRecordid);
        formData.append("screenshot_panel", file);
        let url = apiUrl;
        if (projectId) {
            url = apiUrl + "/" + projectId;
            formData.append("updated_at", new Date().getTime());
        }
        const response = await fetch(url, {
            method: 'POST',
            body: formData,
        });
        const responseJson = await response.json();
        loader(false);
        if (!projectId && responseJson.id) {
            setProjectId(responseJson.id);
        }
    }

    function takeScreenShot(area) {
        mapView.takeScreenshot({
            area: area
        }).then(screenshot => {
            downloadImage("screenshot.png", screenshot.dataUrl)

        })
    }

    function downloadImage(filename, dataUrl) {
        // the download is handled differently in Microsoft browsers
        // because the download attribute for <a> elements is not supported
        if (!window.navigator.msSaveOrOpenBlob) {
            // in browsers that support the download attribute
            // a link is created and a programmatic click will trigger the download
            const element = document.createElement("a");
            element.setAttribute("href", dataUrl);
            element.setAttribute("download", filename);
            element.style.display = "none";
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
        } else {
            // for MS browsers convert dataUrl to Blob
            const byteString = atob(dataUrl.split(",")[1]);
            const mimeString = dataUrl.split(",")[0].split(":")[1].split(";")[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], { type: mimeString });

            // download file
            window.navigator.msSaveOrOpenBlob(blob, filename);
        }
    }

    function setProjectId(id) {
        projectId = id;
    }


    function rotateGraphics() {
        var rotationAngle = 90;
        var geometries = [];
        selectedGraphics.forEach(function (graphic) {
            geometries.push(graphic.geometry)
        });
        var unionGeometry = geometryEngine.union(geometries);
        var rotationCenter = unionGeometry.extent.center;

        selectedGraphics.forEach(function (graphic) {
            var geometry = graphic.geometry;
            var rotatedGeometry = geometryEngine.rotate(geometry, rotationAngle, rotationCenter);
            graphic.geometry = rotatedGeometry;
        });
    }



    function deletePanel() {
        if (selectedGraphics && selectedGraphics.length > 0) {
            var textGraphics = textLayer.graphics.toArray();
            selectedGraphics.forEach(x => {
                graphicsLayer.remove(x);
                // Get the graphics from the layer

                // Filter the graphics based on the value of an attribute
                var filteredGraphics = textGraphics.filter(txt => txt.attributes.graphicId === x.attributes.id);
                filteredGraphics.forEach(x => {
                    textLayer.remove(x);
                })
            });
            selectedGraphics = [];
            getCountOfDroppedPanel();
        }
    }
    function panelDragDropEventListner() {
        mapView.container.addEventListener("dragover", (event) => {
            event.preventDefault();
        })
        mapView.container.addEventListener("drop", (event) => {
            event.preventDefault();
            searchWidget.clear();
            let data = event.dataTransfer.getData('text/plain');
            let dropPanel = JSON.parse(data || "{}");
            if (dropPanel.width && dropPanel.height && dropPanel.panelId && dropPanel.panel) {
                var webMercatorCoords = mapView.toMap({ x: event.clientX, y: event.clientY });
                var geographicCoords = webMercatorUtils.webMercatorToGeographic(webMercatorCoords);
                console.log("Latitude: " + geographicCoords.latitude + ", Longitude: " + geographicCoords.longitude);
                handleImage(geographicCoords, dropPanel.width, dropPanel.height, dropPanel.panelId, dropPanel.panel);
            }
        });
    }

    function handleImage(geographicCoords, widthMeters, heightMeters, panelId, panel) {
        var rectangle = createRectangleGeometry(geographicCoords, heightMeters, widthMeters)
        var polygonGraphic = new Graphic({
            geometry: rectangle,
            symbol: symbol,
            attributes: {
                width: widthMeters,
                height: heightMeters,
                panelId: panelId,
                panel: panel,
                latitude: geographicCoords.latitude,
                longitude: geographicCoords.longitude,
                originalGeometry: rectangle,
                rotationAngle: getRotationAngle(rectangle),
                length: geometryEngine.geodesicLength(rectangle, "meters")
            }
        });
        graphicsLayer.add(polygonGraphic);
        getCountOfDroppedPanel();
    }

    // Create a new polygon geometry with the given height and width
    function createRectangleGeometry(centerPoint, height, width) {
        // Define the rings of the polygon in projected coordinates
        var latitudeDistance = 111132.92 - 559.82 * Math.cos(2 * centerPoint.latitude * Math.PI / 180) + 1.175 * Math.cos(4 * centerPoint.latitude * Math.PI / 180) - 0.0023 * Math.cos(6 * centerPoint.latitude * Math.PI / 180);
        var longitudeDistance = 111320 * Math.cos(centerPoint.latitude * Math.PI / 180);

        var rings = createRings(centerPoint.longitude, centerPoint.latitude, latitudeDistance, longitudeDistance, height, width);

        var polygon = new Polygon({
            rings: rings,
            spatialReference: { wkid: 4326 }
        });
        return polygon;
    }

    function createRings(longitude, latitude, latitudeDistance, longitudeDistance, height, width) {
        var rings = [
            [
                [longitude - width / 2 / longitudeDistance, latitude - height / 2 / latitudeDistance],
                [longitude + width / 2 / longitudeDistance, latitude - height / 2 / latitudeDistance],
                [longitude + width / 2 / longitudeDistance, latitude + height / 2 / latitudeDistance],
                [longitude - width / 2 / longitudeDistance, latitude + height / 2 / latitudeDistance],
                [longitude - width / 2 / longitudeDistance, latitude - height / 2 / latitudeDistance]
            ]
        ];
        return rings;
    }


    function getCountOfDroppedPanel() {
        var graphics = graphicsLayer.graphics.toArray();
        renderDroppedPanelCount(graphics);
    }

    function renderDroppedPanelCount(graphics) {
        const groupedData = graphics.reduce((acc, obj) => {
            const key = obj.attributes.panelId;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(obj);
            return acc;
        }, {});
        let items_container = document.querySelector(".dropped_items");
        let items = "";

        Object.keys(groupedData).forEach(x => {
            // let panel = records.find(record => record.id == x);
            let panel = groupedData[x][0].attributes.panel;
            if (panel)
                items += `<div class="item">
             <div class="dropped_item" >
               <div>
                <img  draggable="true" src="${'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAgICAgJCAkKCgkNDgwODRMREBARExwUFhQWFBwrGx8bGx8bKyYuJSMlLiZENS8vNUROQj5CTl9VVV93cXecnNEBCAgICAkICQoKCQ0ODA4NExEQEBETHBQWFBYUHCsbHxsbHxsrJi4lIyUuJkQ1Ly81RE5CPkJOX1VVX3dxd5yc0f/CABEIAGAAQgMBIgACEQEDEQH/xAAbAAABBQEBAAAAAAAAAAAAAAACAAEDBggHBf/aAAgBAQAAAADzK5CzRsHf+O1eNCLx6Z41WY0wqPVHBqzGhFR6q4PXImFlHqfhFajAXePV+e/AjFhYNeZ0rsaYUGr8+1sEzNHrTPNaZCyi1xnOtC4io9W8bryMAFu/f//EABcBAQEBAQAAAAAAAAAAAAAAAAEAAwL/2gAIAQIQAAAA1C50ANDmNAjqiGj/xAAWAQEBAQAAAAAAAAAAAAAAAAAAAQL/2gAIAQMQAAAAgikoBKJqI//EADsQAAECAgYGCAMHBQAAAAAAAAEAAgMEBQYRElOREzJBUZKiFiEjJDFSVWMzQrEUIjRDc6GyFSVis9L/2gAIAQEAAT8ArZWWscpWWmJaXpeZhQYUe6xjSAGi6F0srT65OcQRrTWYnrpuazC6U1m9bm+JGtFZvXJzjRrPWX1uc410lrJ63OcaiVmrIGOIpud8MRXGP++9oc53WSfEkquhaK30/wBmD3refIFa3CGZTnNt+E3Molo/KbmVeGG3Mq8LfhtzKvNJHZN/dRXN0T+ybqnemMeWMIY6wtHgFXLQitlOW6T8Tss8gXd/e5Ufs+6Nyrux2R+VESw2R+Vd13R82oGV8sfNqimW0cTqj6p2tUt+GgWeGjb9FXENNaaaN8C2O08jVdbiDIohuIMirGYgyKNzE/YqxmIMirGYnKVFDNHE7T5T8pUt+Ggfpt+irhDea0UwQPGMz/W1aJ+4ZhGE/cMwtG87BmEYbtwzCMJ+4ZhaNw3ZhRIbjCiauqdoUse7QP02/RVyY41ppUhh+JD2e01Ohv8AI7Iow33fhu4Smw39dsN/CVo33tR/CU6HEw38JTocS7qOyKdDiaGL2btU7CqPhQzISZc3rMCGTwqtT3islLWPd8Zu322oxH4jsyr78R2ZV95/MdmUXuxHZlF7vO7NX3ed2aiPdon/AHzqnapJ3c5X9Fn0VbHFtY6TAA8YWwYLFpH2fLkFpH/45BaR+8ZBGI/eMgjEfvGQWkfvGQUSI/RROsap2BSLiZGUJPXoWfRVucwVkpHs8DacFivswhxFXoeEOIq9DI+EOIovZhDiKL2YQzKvswhmVFe3RROybqnaVR8FzpCTcCADAhnlVb9D0in7dJbZA3YLF3b3uVWy3vcqtlvf5UTK+/yq2V9/lVsr73Koxl9FE6o2qfKqMif22Qs8Ps0L+IVbmDpDNkxACYUs7OAxXG4oyKuMxRkVcZijIosZijIosZijIq5DxhwlRmQtG8acap+UqipiH/TJCwkj7NC/iFWertPT9MxJqTouNGgPlpS5EbdsNkBgKNUa0+jR82f9JtTq2HwoOaPCV0Lrd6BOZBGpVbvQZvJqNTa1gC2g5kcKNTq1eizGbE+pdbXNcBQczyKjYEWDR0lCitLIjJeG17SfBzWgEL//xAAZEQEAAwEBAAAAAAAAAAAAAAABESAxEAD/2gAIAQIBAT8AAiphx6YVMKmFZ9NP/8QAFBEBAAAAAAAAAAAAAAAAAAAAQP/aAAgBAwEBPwB3/9k='}" height="40" width="30" />
               </div>
               <div class="item_info">
                <h5 class="item_name">  ${panel.field_59}</h5>
                <p class="item_description"><b>${panel.field_47} </b><span><strong>Total Count</strong><label>${groupedData[x].length}</label></span> </p>
               </div>
             </div>
            </div>`
        });
        items_container.innerHTML = items;
    }
    function getRunTimeMeasureMent(line) {
        let meters = geometryEngine.geodesicLength(line, "meters");
        measurements.innerHTML =
            "<b>Meter length</b>:  " + meters.toFixed(2)
    }

    function getPolyLineLength(graphic) {


        let paths = graphic.geometry.paths[0]
        if (paths.length > 1) {
            // Get the graphics from the layer
            var graphics = textLayer.graphics.toArray();
            // Filter the graphics based on the value of an attribute
            var filteredGraphics = graphics.filter(x => x.attributes.graphicId === graphic.attributes.id);
            filteredGraphics.forEach(x => {
                textLayer.remove(x);
            })



            for (var i = 0; i < paths.length - 1; i++) {
                let polyline = {
                    type: "polyline",
                    paths: [[
                        [paths[i][0], paths[i][1]],
                        [paths[i + 1][0], paths[i + 1][1]]],
                    ],
                    spatialReference: {
                        wkid: 102100,
                    },
                };

                let meters = geometryEngine.geodesicLength(polyline, "meters");
                let point = {
                    type: "point",  // autocasts as new Point()
                    x: (paths[i][0] + paths[i + 1][0]) / 2,
                    y: (paths[i][1] + paths[i + 1][1]) / 2,
                    "spatialReference": {
                        "wkid": 102100
                    }
                };
                const newTextGraphic = new Graphic({
                    geometry: point,
                    symbol: {
                        type: "text",
                        text: meters.toFixed(2),
                        color: [255, 255, 255],
                        haloColor: [1, 68, 33],
                        haloSize: 2,
                        font: {
                            family: "Arial Unicode MS",
                            size: 14
                        }
                    },
                    attributes: {
                        graphicId: graphic.attributes.id
                    }


                });
                textLayer.add(newTextGraphic);
            }
        }
    }

    function buildTool(graphic, oldRotationAngle) {
        debugger
        var geometry = graphic.geometry;
        var rotationAngle = getRotationAngle(geometry)
        var centerPoint = { latitude: graphic.geometry.extent.center.latitude, longitude: graphic.geometry.extent.center.longitude };
        var width = graphic.getAttribute("width");
        var height = graphic.getAttribute("height");
        var oldLength = graphic.getAttribute("length").toFixed(2);

        var numCols = Math.floor(geometry.extent.width.toFixed(2) / width.toFixed(2));
        var numRows = Math.floor(geometry.extent.height.toFixed(2) / height.toFixed(2));
        var length = geometryEngine.geodesicLength(graphic.geometry, "meters").toFixed(2)
        console.log(geometry.extent, numCols, numRows)
        if ((numCols > 1 || numRows > 1) && Number(length) > Number(oldLength)) {
            var latitudeDistance = 111132.92 - 559.82 * Math.cos(2 * centerPoint.latitude * Math.PI / 180) + 1.175 * Math.cos(4 * centerPoint.latitude * Math.PI / 180) - 0.0023 * Math.cos(6 * centerPoint.latitude * Math.PI / 180);
            var longitudeDistance = 111320 * Math.cos(centerPoint.latitude * Math.PI / 180);
            for (var i = 0; i < numRows; i++) {
                var rowCenterLatitude = centerPoint.latitude + (i - (numRows - 1) / 2) * height / 111320;
                for (var j = 0; j < numCols; j++) {
                    var columnCenterLongitude = centerPoint.longitude + (j - (numCols - 1) / 2) * width / longitudeDistance;
                    var rings = createRings(columnCenterLongitude, rowCenterLatitude, latitudeDistance, longitudeDistance, height, width)
                    var polygon = new Polygon({
                        rings: rings,
                        // spatialReference: { wkid: 4326 }
                    });
                    console.log({ latitude: polygon.extent.center.latitude, longitude: polygon.extent.center.longitude });
                    let attributes = JSON.parse(JSON.stringify(graphic.attributes))
                    attributes.longitude = polygon.extent.center.longitude
                    attributes.latitude = polygon.extent.center.latitude
                    attributes.originalGeometry = polygon;
                    var rectangle = new Graphic({
                        geometry: polygon,
                        symbol: graphic.symbol,
                        attributes: attributes
                    });

                    graphicsLayer.add(rectangle);
                }
            };
            graphicsLayer.remove(graphic);
            getCountOfDroppedPanel();
        }
        else if (Number(length) != Number(oldLength)) {
            var longitude = graphic.getAttribute("longitude");
            var latitude = graphic.getAttribute("latitude");
            var latitudeDistance = 111132.92 - 559.82 * Math.cos(2 * latitude * Math.PI / 180) + 1.175 * Math.cos(4 * latitude * Math.PI / 180) - 0.0023 * Math.cos(6 * latitude * Math.PI / 180);
            var longitudeDistance = 111320 * Math.cos(latitude * Math.PI / 180);
            var rings = createRings(longitude, latitude, latitudeDistance, longitudeDistance, height, width);
            var polygon = new Polygon({
                rings: rings,
            });
            var rectangle = new Graphic({
                geometry: polygon,
                symbol: graphic.symbol,
                attributes: graphic.attributes
            });
            graphicsLayer.add(rectangle);
            graphicsLayer.remove(graphic);
        }

    }


















});






