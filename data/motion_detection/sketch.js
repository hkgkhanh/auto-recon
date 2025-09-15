let step = 3;
let framerate = 30;
let vid;
let videoIsDone = false;

let flowStep = 8;
let previousPixels;
let flow;

// Create a CCapture object
var capturer = new CCapture({
	format: "png",
	framerate,
	name: "output_images",
	quality: 100
});

let canvas;

function preload() {
	vid = createVideo("sample_video/example_input_vid_slowed.mp4");
	vid.size(680, 480);
	vid.volume(0);
}

function copyImage(src, dst) {
	var n = src.length;
	if (!dst || dst.length != n) dst = new src.constructor(n);
	while (n--) dst[n] = src[n];
	return dst;
}

function same(a1, a2, stride, n) {
	for (var i = 0; i < n; i += stride) {
		if (a1[i] != a2[i]) {
			return false;
		}
	}
	return true;
}

function setup() {
  // Saving the canvas into a variable so it can be used by capturer
	let p5canvas = createCanvas(680, 480);
	canvas = p5canvas.canvas;

	capturer.start();
	vid.play();
  	vid.hide(); // hides the html video loader
  	vid.onended(handleEnd);
  	resizeCanvas(vid.width, vid.height);

  	flow = new FlowCalculator(flowStep);
  	uMotionGraph = new Graph(100, -flowStep / 2, +flowStep / 2);
  	vMotionGraph = new Graph(100, -flowStep / 2, +flowStep / 2);
}

let currentFrameRate;
let lastTime = 0;
function draw() {
  /* Code to stop capture, save animation, and stop the animation */
  // Code below is commented out to prevent downloads on medium
	let secondsElapsed = frameCount / framerate;
	if (videoIsDone) {
		capturer.stop();
		capturer.save();
		noLoop();
		console.log("Render time " + floor(millis() / 1000) + " seconds");
	}
  /* Animation code */
	// background(255);
	let img = vid.get();
  	image(img, 0, 0);

	// vid.loadPixels();
    // if (vid.pixels.length > 0) {
    //     if (previousPixels) {

    //         // cheap way to ignore duplicate frames
    //         if (same(previousPixels, vid.pixels, 4, width)) {
    //             return;
    //         }

    //         flow.calculate(previousPixels, vid.pixels, vid.width, vid.height);
    //     }
    //     previousPixels = copyImage(vid.pixels, previousPixels);
    //     image(img, 0, 0);

    //     if (flow.flow && flow.flow.u != 0 && flow.flow.v != 0) {
    //         uMotionGraph.addSample(flow.flow.u);
    //         vMotionGraph.addSample(flow.flow.v);

    //         strokeWeight(2);
    //         flow.flow.zones.forEach(function(zone) {
    //             stroke(map(zone.u, -flowStep, +flowStep, 0, 255),
    //                 map(zone.v, -flowStep, +flowStep, 0, 255), 128);
    //             line(zone.x, zone.y, zone.x + zone.u, zone.y + zone.v);
    //         })
    //     }

    //     noFill();
    //     stroke(255);

    //     // draw left-right motion
    //     uMotionGraph.draw(width, height / 2);
    //     line(0, height / 4, width, height / 4);

    //     // draw up-down motion
    //     translate(0, height / 2);
    //     vMotionGraph.draw(width, height / 2);
    //     line(0, height / 4, width, height / 4);
    // }

  // Important to have this after the frame is drawn
	capturer.capture(canvas);

  /* Rough framerate display code */
	let seconds = millis() / 1000;
	let elapsed = seconds - lastTime;
	if (elapsed >= 3) {
		currentFrameRate = 1 / (seconds / frameCount);
		console.log("Frames/sec " + currentFrameRate);
		lastTime = seconds;
	}
}

function handleEnd() {
	videoIsDone = true;
}