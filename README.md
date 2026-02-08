# MScroller

MScroller is a Chrome extension for auto-scrolling manga, manhwa, and webtoons. It has adjustable speed, automatic chapter navigation, and reading stats.

## Features

- **Auto-scroll** with adjustable speed (1-50)
- **Auto-continue** to the next chapter with a countdown timer
- **Chapter tracker**: counts total chapters read
- **Session & total time tracking**
- **Click-to-activate**: only runs on a page after you click Start
- **Keyboard shortcuts** for quick control (when active)
- **Floating controls**: a small panel you can drag around the page
- **No per-site code**: finds chapter links with generic patterns, so it works on many manga/manhwa/webtoon sites

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the extension folder

## Usage

1. Open a chapter on a manga, manhwa, or webtoon site
2. Click the extension icon and press Start to activate
3. Adjust scroll speed and settings in the popup
4. The extension will auto-continue to the next chapter when you reach the end

## Keyboard Shortcuts

These shortcuts only work after you click Start to activate the extension on a page.

| Key     | Action               |
| ------- | -------------------- |
| Space   | Start/Stop scrolling |
| Shift+↑ | Increase speed       |
| Shift+↓ | Decrease speed       |
| N       | Next chapter         |
| P       | Previous chapter     |
| H       | Hide/Show UI         |

## Settings

- **Speed**: Adjust scroll speed from 1 (slow) to 50 (fast)
- **Auto-next**: Enable/disable automatic chapter navigation
- **Delay**: Set countdown before next chapter loads

## Stats Tracked

- **Session time**: Current reading session duration
- **Total time**: All-time reading time
- **Chapters read**: Total chapters completed

## How It Works

Scrolling runs on `requestAnimationFrame`, so the speed stays the same regardless of frame rate. To find the next chapter it tries common selectors (`rel="next"`, classes with "next" in them), then links with text like "Next chapter", then a link whose URL has the current chapter number plus one. There is no per-site code, so sites with unusual markup may not be detected.

## Privacy

All data is stored locally on your device. Nothing is sent to any server. The content script is only added to a tab after you use the popup on it.

## Version

v3.2.0
