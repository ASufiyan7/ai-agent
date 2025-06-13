// tools/youtube_transcript.ts

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { YoutubeTranscript } from "youtube-transcript";

// Helper function to extract video ID from various YouTube URL formats
function getYouTubeVideoId(url: string): string | null {
  const urlObj = new URL(url);
  // Standard watch URL: https://www.youtube.com/watch?v=VIDEO_ID
  if (urlObj.hostname === "www.youtube.com" || urlObj.hostname === "youtube.com") {
    return urlObj.searchParams.get("v");
  }
  // Shortened URL: https://youtu.be/VIDEO_ID
  if (urlObj.hostname === "youtu.be") {
    return urlObj.pathname.slice(1);
  }
  return null;
}

export const youtubeTranscriptTool = new DynamicStructuredTool({
  name: "youtube_transcript",
  description: "Fetches the transcript of a given YouTube video URL.",
  // FIX: The schema now accepts a full URL, which is more user-friendly.
  schema: z.object({
    videoUrl: z.string().describe("The full URL of the YouTube video."),
  }),
  func: async ({ videoUrl }) => {
    try {
      // FIX: The tool now extracts the video ID from the URL itself.
      const videoId = getYouTubeVideoId(videoUrl);
      if (!videoId) {
        return `Error: Could not extract a valid YouTube video ID from the URL: ${videoUrl}`;
      }

      const captions = await YoutubeTranscript.fetchTranscript(videoId);
      if (!captions || captions.length === 0) {
        return `No transcript found for YouTube video ID: ${videoId}. The video might not have captions.`;
      }

      const fullTranscript = captions.map((cap) => cap.text).join(" ");
      const snippet = fullTranscript.substring(0, 4500);
      
      return `Transcript for YouTube video ID ${videoId}:\n${snippet}... (truncated)`;
    } catch (error) {
      console.error(`Error fetching YouTube transcript: ${error}`);
      return `An error occurred while trying to fetch the transcript. The video might be private or have disabled captions.`;
    }
  },
});
