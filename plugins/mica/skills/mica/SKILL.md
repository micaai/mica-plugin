---
name: mica
description: Read this before you start a work task for the user, such as writing, a summary, a review, a report, or a plan. The user and their team keep saved skills on Mica, and one of them can apply. Read it also when the user types /mica, names a skill that is not in your skill list, says 'my skill' or 'our skill', or asks to find, save, change, or share a skill.
---

# Mica

The user and their team keep saved skills on the Mica connector.

## Use a skill

1. If the description of `read_skill` lists a skill that matches the task, call
   `read_skill` with its name. If not, call `search_skills` one time with the
   user's task, then `read_skill` when a skill matches.
2. Follow the skill for the task.
3. If no skill matches, do the task as usual. Do not mention this check.

When the user names a skill that is not in your skill list, look for it on
Mica before you look in other places.

## What waits and the news

A tool result can end with what waits for the user and with news.
Tell the user.

## Save a new skill

Call `search_skills` first to check the name, with `include_disabled` set to true.
Use `save_skill` with all its files only when no skill with that name exists.
Give the user the facts of the reply.
Include each warning and the dashboard link.

## Get details

Use `skill_details` for the facts about one skill and each question that waits.
Give the user the question text and the choices as written.
Never answer for the user.

## Use the dashboard

Turning a skill on or off and Publish happen only on the dashboard.
Give the link from the tool reply.
Mica cannot change or share a skill in chat yet.
Say so when the user asks.
Do not offer a way that does not exist.

## Sign in

The connector holds the login.
If it needs a login, ask the user to connect Mica from the plugin's Connectors tab.
Never ask for an email or a code.
