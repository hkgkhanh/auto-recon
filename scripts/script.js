Object.defineProperty(HTMLMediaElement.prototype, 'playing', {
    get: function(){
        return !!(this.currentTime > 0 && !this.paused && !this.ended && this.readyState > 2);
    }
});

const FPS = 30;
const FRAME_INCREMENT = 1/FPS;

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
        // use monospace font
        ctx.font = "15px monospace";
        // use black text
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

function scalePrediction(predictions, video) {
    let canvasWidth = 640;
    let canvasHeight = 480;
    let scaleWidthFrac = canvasWidth / video.videoWidth;
    let scaleHeightFrac = canvasHeight / video.videoHeight;
    let preds = predictions;
    for (let prediction of preds) {
        prediction.bbox.x *= scaleWidthFrac;
        prediction.bbox.y *= scaleHeightFrac;
        prediction.bbox.width *= scaleWidthFrac;
        prediction.bbox.height *= scaleHeightFrac;
    }
    return preds;
}

var seqPredictions = [];
var modelWorkerId;
var playingLoop = false;
var newModel;

async function onloadpage() {
    const inferEngine = new inferencejs.InferenceEngine();

    const modelName = "cube-detection-iv4gl";
    const modelVersion = "2";

    const API_KEY = "rf_Y6NjbvFG1pdwCSS3VWBEJyxjGIn1"; // publishable key

    const configuration = {scoreThreshold: 0.7, iouThreshold: 0.5, maxNumBoxes: 1};
    // const workerId = await inferEngine.startWorker(modelName, modelVersion, API_KEY, [configuration]);

    async function getModel() {
        if (modelWorkerId != null) {
            await inferEngine.stopWorker(modelWorkerId);
        }
        modelWorkerId = null;
        return await inferEngine.startWorker(modelName, modelVersion, API_KEY, [configuration]);
    }

    const videoPreview = document.getElementById("videoPreview");
    const canvas = document.getElementById("video_canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    function detectFrame() {
        if (!modelWorkerId) return requestAnimationFrame(detectFrame);

        playingLoop = videoPreview.playing;
        // if (!videoPreview.playing) return;
    
        if (playingLoop) {
            inferEngine.infer(modelWorkerId, new inferencejs.CVImage(videoPreview)).then(function (predictions) {
                requestAnimationFrame(detectFrame);
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                seqPredictions.push(predictions);
                let tempPredictions = scalePrediction(predictions, videoPreview);

                ctx.drawImage(videoPreview, 0, 0, canvas.width, canvas.height);
                drawBbox(ctx, videoPreview, tempPredictions);

                // // Dừng video sau khi xử lý xong frame hiện tại
                // videoPreview.pause();

                // // Di chuyển đến frame tiếp theo
                // videoPreview.currentTime += FRAME_INCREMENT;

                // // Khi video đã sẵn sàng khung hình tiếp theo, tiếp tục phát và xử lý
                // videoPreview.onseeked = function () {
                //     videoPreview.play();
                //     detectFrame(); // Gọi lại để xử lý frame tiếp theo
                // };
            });
        } else {
            console.log(seqPredictions);
            return true;
        }
    }

    document.getElementById("videoInput").addEventListener("change", async function(event) {
        const file = event.target.files[0];
        // const videoPreview = document.getElementById("videoPreview");

        // const image = document.getElementById("testimg");
        // image.crossOrigin = "Anonymous";

        if (file) {
            newModel = getModel();
            videoPreview.src = URL.createObjectURL(file);
            videoPreview.style.display = "block";
            videoPreview.load();
            videoPreview.onloadedmetadata = async function() {
                seqPredictions = [];
                setTimeout("videoPreview.play();", 2000);
                // videoPreview.play();
            }

            videoPreview.onplay = async function() {
                var [sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight, scalingRatio] = getCoordinates(videoPreview);
            
                // const canvas = document.getElementById("video_canvas");
                // const ctx = canvas.getContext("2d", { willReadFrequently: true });
            
                canvas.width = 640;
                canvas.height = 480;

                newModel.then((workerId) => {
                    modelWorkerId = workerId;
                    // video.style.display = "block";
                    playingLoop = videoPreview.playing;
                    var result = detectFrame(videoPreview, canvas, ctx);
                    // video_canvas.style.display = "block";
        
                    if (result) {
                        console.log(seqPredictions);
                    }
                });
                ctx.scale(1, 1);
            };         
        }

        // Reset input value to ensure the onchange event is triggered on subsequent selections
        event.target.value = '';
    });
}

onloadpage();