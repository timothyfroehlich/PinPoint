This document outlines the research and recommended strategy for implementing video uploads for issues in a cost-effective and user-friendly manner.

### 1. Goal

Allow users to upload short videos (e.g., up to 30 seconds) of pinball machine issues. The implementation must balance server-side costs, performance, and user experience.

### 2. Core Challenge: The Media Handling Trade-Off

Handling video is more complex than handling images. The primary challenge lies in the trade-off between:

- **Simplicity & Cost:** Using a basic file store is cheap and easy but offers a poor video playback experience.
- **Features & Performance:** Using a specialized media platform provides excellent performance (e.g., adaptive streaming) but comes at a higher cost and complexity.

### 3. Option A: Vercel Blob (Simple Storage)

Vercel Blob is a simple, zero-configuration file storage solution. It acts as a basic file server.

- **How it Works:** You upload a file (e.g., a 50MB video), and you get a URL back. When a user views the video, they download the entire 50MB file.
- **Pros:** Extreme simplicity, seamless integration with the Vercel ecosystem.
- **Cons:** No video processing, optimization, or adaptive streaming. Can lead to slow load times and high bandwidth usage for users on mobile devices.

### 4. Option B: Cloudinary (Digital Asset Management)

Cloudinary is a full-featured Digital Asset Management (DAM) platform specializing in media transformation and delivery.

- **How it Works:** You upload one high-resolution video. Cloudinary automatically transcodes it into multiple formats and quality levels. It then delivers the optimal version to each user based on their device and network speed (adaptive bitrate streaming). It can also perform on-the-fly transformations (resizing, cropping, adding watermarks) via URL parameters.
- **Pros:** Superior user experience for video playback, powerful media manipulation features.
- **Cons:** More complex initial setup, higher cost at scale.

### 5. Cost & Free Tier Comparison

For an early-stage application, the free tier and initial scaling costs are critical.

| Feature              | Vercel Blob (Hobby Plan)                                                                      | Cloudinary (Free Plan)              |
| -------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------- |
| **Storage**          | 512 MB                                                                                        | 25 GB                               |
| **Bandwidth**        | 1 GB / month                                                                                  | 25 GB / month                       |
| **Video Processing** | N/A                                                                                           | **5 minutes / month**               |
| **Scaling Cost**     | Requires Vercel Pro (\\$20/mo). Then pay-as-you-go: \\$0.20/GB storage, \\$0.09/GB bandwidth. | First paid plan is **\\$99/month**. |

**Analysis:**
Cloudinary's free tier is generous with storage/bandwidth but is severely limited by its video processing quota. A single 30-second video uses 0.5 minutes of processing, meaning the free plan is exhausted after only **10 video uploads per month**. This would immediately force an upgrade to a costly \\$99/month plan. Vercel Blob's pricing scales much more gradually.

### 6. The Hybrid Solution: Vercel Blob + Client-Side Processing

To get the low, scalable cost of Vercel Blob while mitigating its performance downsides, we can process videos on the client-side _before_ they are uploaded.

**Core Technology:**

- **`ffmpeg.wasm`**: A WebAssembly port of the FFmpeg toolkit that runs in the browser to resize and compress videos.
- **Web Workers**: A browser feature to run the intensive encoding process in a background thread, so the UI remains responsive.

**User Experience Flow:**

1. User selects a video and clicks "Submit."
2. The application immediately sends the video to a background Web Worker. The user is free to navigate the app.
3. The Web Worker uses `ffmpeg.wasm` to shrink the video to a web-friendly size (e.g., 720p) and apply compression.
4. The worker then uploads the new, much smaller file to Vercel Blob.
5. The video appears on the issue page once the background process is complete.

**Trade-offs:**

- **Pro:** Drastically reduces storage/bandwidth costs, making Vercel Blob viable for video.
- **Con:** The user must keep the browser tab open in the background for the process to complete. This is an acceptable limitation for a non-critical, post-1.0 feature.

### 7. Recommendation

For a post-1.0 feature, the most pragmatic and cost-effective approach is the **Hybrid Solution: Vercel Blob + Client-Side Processing**.
This strategy keeps initial and scaling costs to a minimum while providing a good-enough user experience. It avoids the significant price jump of Cloudinary, which can be re-evaluated later if PinPoint's usage and feature requirements grow to a scale that justifies the investment in a dedicated DAM.
