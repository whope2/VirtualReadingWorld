The vision is not to build another social network or book database. It's to build a Virtual Reading World—a peaceful graphical website where readers gather primarily to read, with social interaction happening naturally during reading breaks.

Here's where we left the design.

Version 0.1 Vision

One world

Ocean Beach

One purpose

Read together.

One community

About five invited reader friends.

One platform

Responsive website that works on both desktop and mobile browsers.

No app required.

Core Principles
Reading comes first.
Presence is more important than chat.
Calm is more important than engagement.
No feeds.
No likes.
No followers.
No notifications.

The experience should feel like quietly sharing a beach with other readers.

Recent product evolution

The beach experience now supports a lightweight shared-presence model:

- Multiple readers can appear in the same scene at the same time.
- Readers can move their avatar around the beach and their position is persisted.
- Other readers appear as visible avatars with hover tooltips.
- The current reader is visually highlighted so they are easy to distinguish from other readers.
- Active readers are counted and shown in the scene header.
- The number of active readers is capped by a configurable backend setting, with a default of 10.
- Readers can leave the scene cleanly, and their presence is removed from the shared world.

User Experience

When a reader visits readingisalifestyle.com, they enter the Ocean Beach.

They simply type a username.

No password.

No authentication.

If it's their first visit, a profile is created.

If they've visited before, their profile and reading corner are restored.

Ocean Beach

A static beach image serves as the background.

Readers can

walk
sit
return to their reading corner

Each reader has a small beach umbrella and reading spot.

Their reading corner displays

current book
current page
favorite authors
Reader Information

We decided to avoid clutter.

Default

Only avatars are visible.

Hover (desktop) / Tap (mobile)

A small card appears showing

current book
current page
reading status
Click

A larger profile panel opens with

current read
current page
favorite authors
reading status
Interaction

Instead of full chat, readers send predefined prompts such as:

What are you reading?
How are you liking it?
Recommend it?
Favorite character?
How many pages today?
👋 Wave

The recipient types a short response.

All interactions are stored in the backend.

Technology Stack

Frontend

React
TypeScript
Vite
PixiJS (initially)

Backend

Node.js
Express
Socket.IO
PostgreSQL

Hosting

Your existing Google Cloud VM
readingisalifestyle.com
Mobile Support

Version 0.1 is responsive from the beginning.

The same beach scene adapts to both desktop and phone screens.

Desktop uses hover and click.
Mobile replaces hover with tap.
Avatar positions are stored as percentages so everyone stays in the same place regardless of screen size.