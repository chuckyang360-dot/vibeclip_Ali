# System-Level Regression Fix Summary

## Date: 2026-03-14
## Component: exa_provider.py

## Problem
The `exa_provider.py` file was creating Mention objects with hardcoded default values instead of extracting data from Exa API responses. This caused:
- Empty timestamps in frontend display
- Zero values for likes, comments, shares
- Missing author names
- Missing subreddit tags

## Root Cause
The `_create_mention_from_result` method at lines 291-296 contained:
```python
timestamp=datetime.utcnow(),  # ← HARDCODED
likes=0,  # ← HARDCODED
comments=0,  # ← HARDCODED
shares=0,  # ← HARDCODED
followers=0,  # ← HARDCODED
sentiment="neutral",  # ← HARDCODED
```

Additionally:
- The code tried to use `result.get("created_at")` but Exa API returns `publishedDate`
- The code tried to use `result.get("like_count")` but Exa API doesn't provide this field
- The Exa API provides `author` field but it wasn't being used

## Fix Applied

### 1. Timestamp Extraction (lines 291-299)
**Before:**
```python
if platform == "reddit":
    timestamp = result.get("created_at")  # ← Wrong field name
elif result.get("publishedDate"):
    try:
        timestamp = datetime.fromisoformat(result["publishedDate"].replace("Z", "+00:00"))
    except:
        pass
if not timestamp:
    timestamp = datetime.utcnow()
```

**After:**
```python
# Get timestamp from result (Exa API uses publishedDate for all platforms)
timestamp = None
if result.get("publishedDate"):
    try:
        timestamp = datetime.fromisoformat(result["publishedDate"].replace("Z", "+00:00"))
    except:
        pass
if not timestamp:
    timestamp = datetime.utcnow()
```

### 2. Score/Comments Parsing (lines 301-314)
**Before:**
```python
likes = result.get("like_count", 0)  # ← Field doesn't exist
comments = result.get("comment_count", 0)  # ← Field doesn't exist
```

**After:**
```python
# Parse engagement metrics from text content for Reddit posts
# Exa API embeds Reddit score in text format: "Score: XXX"
likes = 0
comments = 0
if platform == "reddit" and text:
    # Parse score from text (e.g., "Score: 352")
    score_match = re.search(r'Score:\s*(-?\d+)', text, re.IGNORECASE)
    if score_match:
        likes = int(score_match.group(1))

    # Parse comment count from text (e.g., "215 Comments")
    comments_match = re.search(r'(\d+)\s+Comments?', text, re.IGNORECASE)
    if comments_match:
        comments = int(comments_match.group(1))
```

### 3. Author Extraction (lines 245-269)
**Before:**
```python
author_info = {"author": "", "author_username": "", "author_display_name": ""}
if platform == "reddit":
    author_info = self._extract_reddit_author(url, title)
```

**After:**
```python
author_info = {"author": "", "author_username": "", "author_display_name": ""}

# Use Exa API's author field if available
if result.get("author"):
    author_name = result.get("author", "")
    author_info["author"] = author_name
    author_info["author_username"] = author_name
    author_info["author_display_name"] = author_name

# For Reddit, also try to extract from URL as fallback
if platform == "reddit" and not author_info["author"]:
    author_info = self._extract_reddit_author(url, title)
```

## Test Results
All tests passed:

1. ✓ TIMESTAMP EXTRACTION: Correctly parses `publishedDate` (2025-03-23 15:12:51)
2. ✓ SCORE PARSING: Correctly extracts score from "Score: 352" → 352
3. ✓ COMMENT COUNT PARSING: Correctly extracts from "215 Comments" → 215
4. ✓ AUTHOR EXTRACTION: Correctly uses `result.get("author")` → "Sunkeren"
5. ✓ SUBREDDIT EXTRACTION: Correctly extracts from URL `/r/electricvehicles/` → "electricvehicles"

## Limitations

The following limitations remain due to Exa API data structure:
- `author_username` and `author_display_name` will use the same value as `author` (Exa API only provides one author field)
- `follower_count` remains 0 (Exa API doesn't provide this field)
- `sentiment` remains "neutral" (Exa API doesn't provide sentiment - would need AI analysis)
- Score and comment counts are only available for Reddit (embedded in text), not for X/Twitter or SEO sources

## Files Modified
- `/Users/johnstills/Documents/Vibe Marckrting/backend/app/providers/exa_provider.py`
- `/Users/johnstills/Documents/Vibe Marckrting/backend/app/analysis/topics.py` (word length threshold 3→2)

## Files Created for Testing
- `/Users/johnstills/Documents/Vibe Marckrting/backend/test_exa_fix.py` (validation test)

## Backend Status
The backend is running but requires `EXA_API_KEY` environment variable to make real API calls.
Without the API key, the `/api/full-analysis` endpoint will fail with:
```
ValueError: EXA_API_KEY environment variable is required. Please set it in your .env file.
```
