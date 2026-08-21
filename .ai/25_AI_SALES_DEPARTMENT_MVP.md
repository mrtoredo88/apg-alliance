# APG AI Sales Department MVP

## Goal

Build a controlled AI-assisted sales pipeline for APG partner acquisition. The first version must increase throughput without allowing autonomous outbound spam or uncontrolled publication.

## Roles

1. Scout agent
   - creates and enriches leads;
   - captures website, social links, contact/decision maker and basic business signals.

2. Analyst agent
   - scores leads from 0 to 100;
   - assigns high / medium / low priority;
   - explains score with human-readable reasons.

3. Sales agent
   - creates a personalized APG offer draft from category and observed signals;
   - supports human editing before contact.

4. Communicator agent
   - MVP: tracks stage and next action only;
   - no autonomous sending;
   - later: prepare follow-ups and email drafts behind explicit approval.

5. Manager agent
   - summarizes funnel totals, high-priority leads, contacts, replies, meetings and wins;
   - produces a daily action queue.

6. Learning agent (phase 2)
   - compares message variants and outcomes;
   - learns which hooks, lengths and offers correlate with replies and conversion.

## Safety boundary

The system may analyze, score, recommend and generate drafts. It must not autonomously send outbound messages, publish content, promise commercial terms, or create partner records as published entities without explicit approval.

## MVP data model

A lead contains:

- id
- name
- category
- website / vk / telegram
- contact / decision maker
- qualification signals
- score
- priority
- reasons
- stage
- offerDraft
- createdAt / updatedAt

Stages:

`discovered -> qualified -> offer_ready -> contacted -> replied -> meeting -> won | lost`

## Current implementation

- `src/salesAi/salesAgentCore.js`
  - deterministic scoring;
  - APG-specific offer draft generation;
  - pipeline summary;
  - next-best-action engine.

- `src/salesAi/SalesAiDashboard.jsx`
  - lead intake;
  - qualification view;
  - editable offer draft;
  - stage management;
  - top-level funnel metrics;
  - localStorage persistence for prototype validation.

## Phase 1.1

- mount dashboard inside AdminPanel as `AI-отдел продаж`;
- move persistence from localStorage to backend data store;
- add admin-only read/write actions;
- add duplicate detection;
- add tags for city / district / category / source;
- add explicit `approve` transitions before outbound actions.

## Phase 1.2

- connect Scout to approved public search sources;
- store source URLs and evidence for every enriched field;
- add contact discovery and confidence labels;
- add batch import with duplicate prevention.

## Phase 1.3

- connect LLM-backed Analyst/Sales roles;
- preserve deterministic score as guardrail and baseline;
- produce structured JSON results with rationale and evidence;
- generate 2-3 offer variants, not a single generic template.

## Phase 2

- Gmail/CRM communicator behind approval;
- follow-up scheduling;
- reply classification;
- meeting preparation briefs;
- manager daily digest;
- learning loop based on reply and conversion outcomes.

## Success metrics

- qualified leads per day;
- human review time per lead;
- first-contact reply rate;
- meeting conversion;
- partner conversion;
- percentage of generated drafts sent without major edits;
- duplicate/error rate;
- outbound actions without approval: must remain zero in MVP.
