# Job Listing Insights

> **Unofficial project.** Not affiliated with, endorsed by, or sponsored by Info Edge (India) Ltd. or Naukri. "Naukri" is a trademark of its owner and is used here only to say which website this works with.

A small Chrome extension (Manifest V3) that adds context to the job pages you already browse on naukri.com: how well a listing matches your skills, whether your experience fits, when it was posted (in IST), and how many people have viewed and applied.

It only reads data your browser has already received. It makes **no requests of its own** and sends **nothing** anywhere.

<!-- Add screenshots here. Blur or mock company names and listing details; do not commit images of real listings. -->

## What it does

**Search results page**
- Each job card gets an **Experience Fit** (Good / Close / Poor) and a **Posted On** time in IST.
- A **Top matches** panel ranks the jobs on the page by how many of your skills they mention.

**Job details page**
- One card showing **Skill Score [Yours | Matched | Mentioned]**, with an (i) tooltip listing matched and unmatched skills, plus **Experience Fit**, **Posted On**, and **Views / Applies**.

**Profile sync**
- When you open your own profile, the extension reads only the key-skills field and keeps it in extension storage. Your skill list then updates itself, and a small notice shows what changed. Until the first sync, a built-in fallback list is used.

## Privacy

- It reads three of the site's own responses as your page receives them: search results, job details, and your profile (**key skills only**).
- Everything else in the profile response (name, phone, email, employment history, salary) is dropped before the extension's own code sees it.
- The only thing it stores is your skills list, in `chrome.storage.local` on your device.
- No analytics, no telemetry, no remote servers, no third-party requests.
- Permissions: `storage`, and content scripts that run only on `https://www.naukri.com/*`.

## Responsible use

The site's [terms and conditions](https://www.naukri.com/termsconditions) restrict automated scraping and crawling, access outside the interfaces the site provides, and commercial derivative works. This project is built to stay on the right side of that, and contributions must keep it that way:

- **No requests of its own.** It only reads responses the page already made for you.
- **No crawling, automation, or bulk collection.** It works only on pages you open yourself.
- **No redistribution.** Don't republish or sell listing data, and don't export other people's data.
- **Non-commercial.** It is free and stays free.
- **No site content in this repository.** No saved HTML, sample API responses, or logos.

You are responsible for how you use it. Read the site's terms yourself. Using any browser extension on a site could in principle lead the site to restrict your account, so use it at your own risk. Nothing here is legal advice.

## Install

It is not on the Chrome Web Store.

1. Download or clone this repository.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the project folder.
4. Hard-reload naukri.com. After reloading the extension, reload open Naukri tabs too.
5. Open your profile page once to sync your skills.

## Configure

Settings are at the top of content.js:

Setting	What it does
1. MY_EXP_YEARS	Your years of experience, used for the Experience Fit check
2. FALLBACK_SKILLS	Skills used until your profile has been synced
3. EXTRA_SKILLS	Skills you have but haven't listed on your profile
4. IGNORE_SKILLS	Profile entries to leave out (typos, generic terms)
5. NEEDS_JS	Names that must appear with "js" in job text to count (for example next)
6. DEBUG	Verbose console logging

# Contributing

Issues are welcome. Pull requests that add automated or background requests, bulk collection, data export, or telemetry will not be accepted.