const VIDEO_FPS = 30;
const FRAME_INCREMENT = 1 / VIDEO_FPS;

var seqPredictions = [];
var cubePredictions = [];
var modelWorkerId;
var playingLoop = false;
var newModel;

function padNumber(number, length) {
    return number.toString().padStart(length, '0');
}

function drawBoundingBoxes(predictions, canvas, ctx, scalingRatio, sx, sy, fromDetectAPI = false) {  
    for (var i = 0; i < predictions.length; i++) {
        var confidence = predictions[i].confidence;
        ctx.scale(1, 1);
        ctx.strokeStyle = "#cccc00";
    
        var prediction = predictions[i];
        var x = prediction.bbox.x - prediction.bbox.width / 2;
        var y = prediction.bbox.y - prediction.bbox.height / 2;
        var width = prediction.bbox.width;
        var height = prediction.bbox.height;
    
        if (!fromDetectAPI) {
            x -= sx;
            y -= sy;
    
            x *= scalingRatio;
            y *= scalingRatio;
            width *= scalingRatio;
            height *= scalingRatio;
        }
    
        // if box is partially outside 640x480, clip it
        if (x < 0) {
            width += x;
            x = 0;
        }
    
        if (y < 0) {
            height += y;
            y = 0;
        }
    
        // if first prediction, double label size
        ctx.rect(x, y, width, width);
    
        ctx.fillStyle = "rgba(0, 0, 0, 0)";
        ctx.fill();
    
        ctx.fillStyle = ctx.strokeStyle;
        ctx.lineWidth = "4";
        ctx.strokeRect(x, y, width, height);
        // put colored background on text
        var text = ctx.measureText(prediction.class + " " + Math.round(confidence * 100) + "%");

        if (y < 20) {
            y = 30;
        }
    
        // make sure label doesn't leave canvas
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fillRect(x - 2, y - 30, text.width + 4, 30);
        ctx.font = "15px monospace";
        ctx.fillStyle = "black";
    
        ctx.fillText(
            prediction.class + " " + Math.round(confidence * 100) + "%",
            x,
            y - 10
        );
    }
}

function drawBbox(ctx, video, predictions) {
    ctx.beginPath();
    var [sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight, scalingRatio] = getCoordinates(video);
    drawBoundingBoxes(predictions, video, ctx, scalingRatio, sx, sy);
    ctx.closePath();
}

function getCoordinates(img) {
    var dx = 0;
    var dy = 0;
    var dWidth = 640;
    var dHeight = 480;
  
    var sy;
    var sx;
    var sWidth = 0;
    var sHeight = 0;
  
    var imageWidth = img.width;
    var imageHeight = img.height;
  
    const canvasRatio = dWidth / dHeight;
    const imageRatio = imageWidth / imageHeight;
  
    // scenario 1 - image is more vertical than canvas
    if (canvasRatio >= imageRatio) {
      var sx = 0;
      var sWidth = imageWidth;
      var sHeight = sWidth / canvasRatio;
      var sy = (imageHeight - sHeight) / 2;
    } else {
      // scenario 2 - image is more horizontal than canvas
      var sy = 0;
      var sHeight = imageHeight;
      var sWidth = sHeight * canvasRatio;
      var sx = (imageWidth - sWidth) / 2;
    }
  
    var scalingRatio = dWidth / sWidth;
  
    if (scalingRatio == Infinity) {
      scalingRatio = 1;
    }
  
    return [sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight, scalingRatio];
}

function scalePrediction(predictions, video, canvasWidth = 640, canvasHeight = 480) {
    // let canvasWidth = 640;
    // let canvasHeight = 480;
    let scaleWidthFrac = canvasWidth / video.videoWidth;
    let scaleHeightFrac = canvasHeight / video.videoHeight;
    let preds = predictions;
    for (let prediction of preds) {
        if (prediction != null) {
            prediction.bbox.x *= scaleWidthFrac;
            prediction.bbox.y *= scaleHeightFrac;
            prediction.bbox.width *= scaleWidthFrac;
            prediction.bbox.height *= scaleHeightFrac;
        }
    }
    return preds;
}

document.getElementById("videoInput").addEventListener("input", function (event) {
    const file = event.target.files[0];
    const inferEngine = new inferencejs.InferenceEngine();
    const modelName = "cube-detection-iv4gl";
    const modelVersion = "2";
    const API_KEY = "rf_Y6NjbvFG1pdwCSS3VWBEJyxjGIn1"; // publishable key
    const configuration = {scoreThreshold: 0.7, iouThreshold: 0.5, maxNumBoxes: 1};
    modelWorkerId = null;

    async function getModel() {
        if (modelWorkerId != null) {
            await inferEngine.stopWorker(modelWorkerId);
        }
        modelWorkerId = null;
        return await inferEngine.startWorker(modelName, modelVersion, API_KEY, [configuration]);
    }

    if (file) {
        newModel = getModel();
        const video = document.getElementById("videoPreview");
        const canvas = document.getElementById("video_canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        let totalFrames = 0;
        let currentFrame = 0;

        let imageszip = new JSZip();
        let frameImages = [];
        let canvasFrames = [];

        let predboxzip = new JSZip();
        let framePredBoxs = [];
        let canvasPredBoxs = [];

        video.src = URL.createObjectURL(file);
        // video.style.display = "block";
        video.load();

        video.onloadedmetadata = async function () {
            totalFrames = Math.floor(video.duration * VIDEO_FPS);
            seqPredictions = [];
            cubePredictions = [];

            imageszip = new JSZip();
            frameImages = [];
            canvasFrames = [];

            predboxzip = new JSZip();
            framePredBoxs = [];
            canvasPredBoxs = [];

            var [sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight, scalingRatio] = getCoordinates(video);
        
            canvas.width = 640;
            canvas.height = 480;

            newModel.then((workerId) => {
                modelWorkerId = workerId;
                processFrame();
            });
            ctx.scale(1, 1);
        };

        // Đọc và xử lý từng frame
        const processFrame = async () => {
            if (currentFrame > totalFrames) {
                console.log(seqPredictions);
                console.log("Finished processing all frames.");
                console.log("Video duration: " + video.duration);
                console.log(canvasFrames);

                inferEngine.stopWorker(modelWorkerId);

                // post-process predictions
                for (let i = 0; i < seqPredictions.length; i++) {
                    let indexOfCube = -1;
                    for (let j = 0; j < seqPredictions[i].length; j++) {
                        if (seqPredictions[i][j].class == "cube") {
                            indexOfCube = j;
                            break;
                        }
                    }
                    if (indexOfCube == -1) {
                        cubePredictions.push(null);
                    } else {
                        cubePredictions.push(seqPredictions[i][indexOfCube]);
                    }
                }

                let maxW = 0;
                let maxH = 0;
                for (let i = 0; i < cubePredictions.length; i++) {
                    if (cubePredictions[i] != null) {
                        if (cubePredictions[i].bbox.width > maxW) maxW = cubePredictions[i].bbox.width;
                        if (cubePredictions[i].bbox.height > maxH) maxH = cubePredictions[i].bbox.height;
                    }
                }

                for (let i = 0; i < cubePredictions.length; i++) {
                    if (cubePredictions[i] != null) {
                        cubePredictions[i].bbox.width = maxW;
                        cubePredictions[i].bbox.height = maxH;
                    }
                }
                console.log(cubePredictions);

                for (let i = 0; i < canvasFrames.length; i++) {
                    let tempctx = canvasFrames[i].getContext("2d");
                    if (cubePredictions[i] != null) {
                        drawBbox(tempctx, video, [cubePredictions[i]]);
                    }
                    
                    let frameData = canvasFrames[i].toDataURL("image/png");
                    let imageFileName = padNumber(i, 4);
                    if (!frameImages.some(frame => frame.filename === `frame_${imageFileName}.png`)) {
                        frameImages.push({ filename: `frame_${imageFileName}.png`, data: frameData });
                        imageszip.file(`frame_${imageFileName}.png`, frameData.split(',')[1], { base64: true });
                    }
                }

                let [sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight, scalingRatio] = getCoordinates(video);
                let tempPreds = scalePrediction(cubePredictions, video, maxW * scalingRatio, maxH * scalingRatio);
                // drawBoundingBoxes(predictions, video, ctx, scalingRatio, sx, sy);
                for (let i = 0; i < canvasPredBoxs.length; i++) {
                    let tempctx = canvasPredBoxs[i].getContext("2d");
                    if (cubePredictions[i] == null) {
                        continue;
                    }

                    let desCanvas = document.createElement("canvas");
                    desCanvas.width = maxW;
                    desCanvas.height = maxH;
                    let desCanvasCtx = desCanvas.getContext("2d");

                    var x = tempPreds[i].bbox.x - tempPreds[i].bbox.width / 2;
                    var y = tempPreds[i].bbox.y - tempPreds[i].bbox.height / 2;
                    var width = maxW;
                    var height = maxH;
                
                    // x -= sx;
                    // y -= sy;
            
                    x *= scalingRatio;
                    y *= scalingRatio;
                    width *= scalingRatio;
                    height *= scalingRatio;
                    
                    desCanvasCtx.drawImage(canvasPredBoxs[i], x, y, width, height, 0, 0, width, height);
                    
                    let frameData = desCanvas.toDataURL("image/png");
                    let imageFileName = padNumber(i, 4);
                    if (!frameImages.some(frame => frame.filename === `pred_frame_${imageFileName}.png`)) {
                        frameImages.push({ filename: `pred_frame_${imageFileName}.png`, data: frameData });
                        predboxzip.file(`pred_frame_${imageFileName}.png`, frameData.split(',')[1], { base64: true });
                    }
                }

                // document.getElementById("downloadImages").style.display = "block";
                let downloadImagesButton = document.createElement("button");
                downloadImagesButton.setAttribute("id", "downloadImages");
                downloadImagesButton.textContent = "Download all images (full)";

                // Khi nhấn nút download tất cả frame
                downloadImagesButton.addEventListener("click", async function () {
                    const content = await imageszip.generateAsync({ type: "blob" });
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(content);
                    link.download = "processed_frames.zip";
                    link.click();
                    downloadImagesButton.remove();
                });
                document.body.appendChild(downloadImagesButton);

                let downloadPredImagesButton = document.createElement("button");
                downloadPredImagesButton.setAttribute("id", "downloadPredImages");
                downloadPredImagesButton.textContent = "Download all prediction images";

                // Khi nhấn nút download tất cả frame
                downloadPredImagesButton.addEventListener("click", async function () {
                    const content = await predboxzip.generateAsync({ type: "blob" });
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(content);
                    link.download = "processed_pred_frames.zip";
                    link.click();
                    downloadPredImagesButton.remove();
                });
                document.body.appendChild(downloadPredImagesButton);

                return;
            }

            // Di chuyển tới thời gian của frame hiện tại
            video.currentTime = currentFrame / VIDEO_FPS;

            video.onseeked = async () => {
                // Chuyển frame trên canvas thành ảnh OpenCV
                const src = cv.imread(canvas);
                console.log("Processing frame:", currentFrame + "/" + totalFrames);

                await inferEngine.infer(modelWorkerId, new inferencejs.CVImage(video)).then(function (predictions) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
                    seqPredictions.push(predictions);
                    let tempPredictions = scalePrediction(predictions, video);
    
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    // let frameData = canvas.toDataURL("image/png");
                    // if (!frameImages.some(frame => frame.filename === `frame_${padNumber(currentFrame, 4)}.png`)) {
                    //     let imageFileName = padNumber(currentFrame, 4);
                    //     frameImages.push({ filename: `frame_${imageFileName}.png`, data: frameData });
                    //     zip.file(`frame_${imageFileName}.png`, frameData.split(',')[1], { base64: true });
                    // }

                    // Lưu canvas hiện tại vào mảng
                    let canvasCopy = document.createElement('canvas');
                    canvasCopy.width = canvas.width;
                    canvasCopy.height = canvas.height;
                    const copyCtx = canvasCopy.getContext('2d');
                    copyCtx.drawImage(canvas, 0, 0); // Sao chép nội dung canvas
                    canvasFrames.push(canvasCopy);

                    let canvasPredCopy = document.createElement('canvas');
                    canvasPredCopy.width = canvas.width;
                    canvasPredCopy.height = canvas.height;
                    const copyPredCtx = canvasPredCopy.getContext('2d');
                    copyPredCtx.drawImage(canvas, 0, 0); // Sao chép nội dung canvas
                    canvasPredBoxs.push(canvasPredCopy);

                    drawBbox(ctx, video, tempPredictions);
                });

                // // Lưu frame đã xử lý dưới dạng Base64
                // const frameData = canvas.toDataURL("image/png");
                // frameImages.push({ filename: `frame_${currentFrame}.png`, data: frameData });

                // // Thêm vào file ZIP
                // zip.file(`frame_${padNumber(currentFrame, 4)}.png`, frameData.split(',')[1], { base64: true });
                
                src.delete();

                // Chuyển sang frame tiếp theo
                currentFrame++;
                processFrame();
            };
        };
    }
    event.target.value = '';
});
