"""Public YouTube captions via youtube-transcript-api (no account or LLM key).

Usage: python3 transcript.py VIDEO_ID
Writes one JSON result to stdout. HTTP requests preserve inherited proxy settings;
blocked destinations, disabled captions and unavailable translations are gaps.
Requires youtube-transcript-api>=1.2,<2 (pip install -r requirements.txt).
"""
import json
import re
import sys


def main():
    video_id = sys.argv[1] if len(sys.argv) == 2 else ""
    if not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
        print(json.dumps({"error": "Invalid video id."}))
        return
    try:
        import requests
        from youtube_transcript_api import YouTubeTranscriptApi

        class TimeoutSession(requests.Session):
            def request(self, method, url, **kwargs):
                kwargs.setdefault("timeout", 15)
                return super().request(method, url, **kwargs)

        api = YouTubeTranscriptApi(http_client=TimeoutSession())
        transcripts = api.list(video_id)
        try:
            chosen = transcripts.find_transcript(["en", "en-US", "en-GB"])
        except Exception:
            # English translation is an explicit provenance fact, never hidden.
            translatable = [item for item in transcripts if item.is_translatable]
            if not translatable:
                print(json.dumps({"error": "No English or translatable captions available."}))
                return
            chosen = translatable[0].translate("en")
        result = chosen.fetch()
        print(json.dumps({
            "language": chosen.language_code,
            "is_generated": chosen.is_generated,
            "transcript": [{"text": item.text, "start": item.start, "duration": item.duration} for item in result],
        }))
    except ImportError:
        print(json.dumps({"error": "youtube-transcript-api is not installed; run pip install -r apps/wow/scraper/requirements.txt."}))
    except Exception as error:
        # Avoid leaking request URLs, authentication state or proxy headers.
        print(json.dumps({"error": f"Transcript unavailable ({type(error).__name__}); captions may be disabled or source access blocked."}))


if __name__ == "__main__":
    main()
