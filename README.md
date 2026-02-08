# MScroller

MScroller is a Chrome extension for auto-scrolling manga, manhwa, and webtoons. It provides a smooth reading experience with customizable speed, automatic chapter navigation, and reading stats.

## Features

- **Buttery smooth 60fps scrolling** with customizable speed (1-50)
- **Auto-continue** to the next chapter with a countdown timer
- **Chapter tracker**: counts total chapters read
- **Session & total time tracking**
- **Click-to-activate**: privacy-friendly, only runs when you click Start
- **Keyboard shortcuts** for quick control (when active)
- **Modern teal UI**: floating controls, draggable, and easy to use
- **Works on most manga/manhwa/webtoon sites** (smart pattern detection, no hardcoded sites)

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the extension folder

## Usage

1. Visit your favorite manga, manhwa, or webtoon site
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

MScroller uses smart pattern detection to work on most manga, manhwa, and webtoon sites. It automatically finds next and previous chapter links, scrolls the page for you, and provides a seamless reading experience. No site-specific code required—just install and start reading!

## Privacy

All data is stored locally on your device. Nothing is sent to any server. The extension only activates when you explicitly click Start—it never runs automatically in the background.

## Version

v3.2.0
