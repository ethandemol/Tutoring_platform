#!/usr/bin/env python3
"""
YouTube Transcript Fetcher

This script fetches transcripts from YouTube videos using the youtube-transcript-api.
It supports proxy configuration and returns structured transcript data.
"""

import sys
import json
import argparse
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.proxies import WebshareProxyConfig
from youtube_transcript_api.formatters import JSONFormatter

def fetch_transcript(video_id, proxy_config=None):
    """
    Fetch transcript from YouTube video
    
    Args:
        video_id (str): YouTube video ID
        proxy_config (dict): Optional proxy configuration
        
    Returns:
        dict: Transcript data with snippets and metadata
    """
    try:
        # Configure proxy if provided
        if proxy_config and 'proxy_username' in proxy_config and 'proxy_password' in proxy_config:
            # Create WebshareProxyConfig for youtube-transcript-api
            proxy_config_obj = WebshareProxyConfig(
                proxy_username=proxy_config['proxy_username'],
                proxy_password=proxy_config['proxy_password']
            )
            
            # Create YouTubeTranscriptApi instance with proxy
            ytt_api = YouTubeTranscriptApi(proxy_config=proxy_config_obj)
            
            # Fetch transcript with proxy
            transcript_list = ytt_api.fetch(video_id)
        else:
            # Create YouTubeTranscriptApi instance without proxy
            ytt_api = YouTubeTranscriptApi()
            
            # Fetch transcript without proxy
            transcript_list = ytt_api.fetch(video_id)
        
        # Calculate total duration and convert snippets to dictionaries
        total_duration = 0
        snippets_list = []
        
        if transcript_list:
            for snippet in transcript_list:
                # Convert FetchedTranscriptSnippet to dictionary
                snippet_dict = {
                    'text': snippet.text,
                    'start': snippet.start,
                    'duration': snippet.duration
                }
                snippets_list.append(snippet_dict)
            
            # Calculate total duration from last snippet
            if snippets_list:
                last_snippet = snippets_list[-1]
                total_duration = float(last_snippet['start']) + float(last_snippet['duration'])
        
        # Format the transcript data
        transcript_data = {
            'video_id': video_id,
            'snippets': snippets_list,
            'total_duration': total_duration,
            'snippet_count': len(snippets_list),
            'success': True
        }
        
        return transcript_data
        
    except Exception as e:
        return {
            'video_id': video_id,
            'error': str(e),
            'success': False
        }

def main():
    """Main function to handle command line arguments and fetch transcript"""
    if len(sys.argv) < 3:
        print("Usage: python youtube_transcript_fetcher.py <video_id> <output_file> [proxy_config_json]", file=sys.stderr)
        sys.exit(1)
    
    video_id = sys.argv[1]
    output_file = sys.argv[2]
    proxy_config = None
    
    # Parse proxy configuration if provided
    if len(sys.argv) > 3:
        try:
            proxy_config = json.loads(sys.argv[3])
        except json.JSONDecodeError:
            print("Invalid proxy configuration JSON", file=sys.stderr)
            sys.exit(1)
    
    # Fetch transcript
    result = fetch_transcript(video_id, proxy_config)
    
    # Write result to output file
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"Transcript data written to {output_file}")
    except Exception as e:
        print(f"Error writing to output file: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main() 