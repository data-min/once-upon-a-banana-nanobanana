# Once Upon a Banana

An AI-powered children’s storytelling web application. The app allows kids to create their own illustrated books by combining text, image, drawing, voice, and video prompts.

## Features

-   **Interactive & Full Story Modes**: Create a story page-by-page or generate a complete book from a single idea.
-   **Multi-Modal Inputs**: Use text, upload images, draw pictures, record your voice, or even act out a scene on video to inspire the story.
-   **Customizable Styles**: Choose from a list of predefined art styles or describe your own unique vision.
-   **Page-by-Page Revisions**: Easily edit the text or regenerate the illustration for any page.
-   **AI Video Generation**: Generate a short, animated video clip for each page of the story using Google's VEO model.
-   **Client-Side Video Assembly**: Combine the individual page videos into a full movie of your story, right in your browser.
-   **Local Library**: Your creations are automatically saved in your browser's local storage for you to revisit and continue later.

## Getting Started

### Prerequisites

-   A modern web browser (like Chrome, Firefox, or Edge) that supports the necessary Web APIs (see Dependencies).
-   A Google Gemini API key.

### API Key Setup

This application requires a Google Gemini API key to function. The key must be available as an environment variable named `API_KEY`.

The application code expects to access this key via `process.env.API_KEY`. In a typical client-side deployment, you must have a server or build process that makes this environment variable accessible to the JavaScript code. The application itself does not include a UI for users to input a key.

### Running the App

1.  Set up a local web server or a hosting environment.
2.  Configure your environment to provide the `API_KEY` to the client-side code.
3.  Serve the `index.html` file and its associated assets.

## Video Generation Workflow

The video creation is a two-stage process handled entirely within the browser, requiring no server-side processing or external software like FFmpeg.

### Stage 1: Scene Generation (per page)

1.  **Initiation**: In the "Story Creator" view, each page has a "Create Page Video" button.
2.  **API Call**: Clicking this button triggers a call to the `generateSinglePageVideo` function in `services/geminiService.ts`. This function constructs a detailed prompt including the page text, style, and the page's illustration as a reference image.
3.  **VEO Model**: The request is sent to Google's `veo-3.0-fast-generate-preview` model via the Gemini API. This is an asynchronous operation that can take several minutes to complete.
4.  **Polling & Response Handling**: The application polls the `getVideosOperation` endpoint to check the status of the video generation job. During this time, the UI displays real-time progress updates received from the API.
5.  **Result**: Once complete, the VEO service provides a URI for the generated video. The application appends the API key to this URI to create a direct, temporary download link for the MP4 video clip. This URL is then saved to the page's data.

### Stage 2: Full Video Assembly

1.  **Availability**: Once videos have been generated for *all* pages in a book, the "Create Full Story Video" button becomes available in the "Book Viewer".
2.  **Client-Side Processing**: Clicking this button opens the `VideoGeneratorModal`, which kicks off the assembly process defined in `utils/videoGenerator.ts`.
3.  **Fetching**: The modal first fetches the video data from each page's unique URL and converts them into local `Blob` objects.
4.  **Combining**: Using browser APIs, the script plays each video scene sequentially while drawing its frames onto a `<canvas>` element. The audio from each scene is simultaneously captured and merged using the `Web Audio API`.
5.  **Recording**: The combined audio and video streams from the canvas are recorded using the `MediaRecorder API` into a single new video stream.
6.  **Final Output**: The final recorded stream is converted into a `Blob` and presented to the user as a downloadable WebM video file.

## Dependencies

This project relies on the Google GenAI SDK and several modern browser APIs.

-   **`@google/genai`**: The official Google GenAI SDK for JavaScript. It is loaded directly in `index.html` via a CDN using an import map.
-   **Browser APIs**: The application's functionality is heavily dependent on the following browser features:
    -   **`MediaRecorder API`**: For recording video/audio and assembling the final movie.
    -   **`Canvas API`**: For the drawing feature and for processing video frames during assembly.
    -   **`Web Audio API`**: For capturing and merging audio tracks from video scenes.
    -   **`Web Speech API`**: For speech-to-text transcription.
    -   **`getUserMedia`**: For accessing the camera and microphone.