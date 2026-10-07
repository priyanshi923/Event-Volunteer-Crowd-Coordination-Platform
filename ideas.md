BUILD / REFACTOR THE EVENTS MODULE FOR OUR EVENT VOLUNTEER & CROWD COORDINATION PLATFORM.

IMPORTANT: READ THIS ENTIRE PROMPT BEFORE MODIFYING THE CODE.

We are building an "Event Volunteer & Crowd Coordination Platform" based on the provided problem statement.

The attached reference image is ONLY a visual reference for how we want events to be displayed.

============================================================
CORE RULE — NO HARDCODED DATA
============================================================

DO NOT hardcode ANY event data into the frontend.

This means:

❌ No hardcoded event names
❌ No hardcoded event descriptions
❌ No hardcoded dates
❌ No hardcoded times
❌ No hardcoded locations
❌ No hardcoded categories
❌ No hardcoded event images
❌ No hardcoded volunteer counts
❌ No hardcoded roles
❌ No hardcoded shifts
❌ No hardcoded tasks
❌ No hardcoded users/volunteers
❌ No hardcoded dashboard statistics

The UI must NEVER depend on example events written directly inside React/HTML components.

All actual application data must come from the backend/database.

If the database is empty, the UI must show a proper empty state instead of fake/demo events.

============================================================
1. UNDERSTAND THE PRODUCT FLOW
============================================================

This is NOT a generic event-discovery website.

The actual flow is:

ORGANIZER
    ↓
CREATE EVENT
    ↓
EVENT SAVED TO DATABASE
    ↓
EVENT APPEARS ON EVENTS PAGE
    ↓
ORGANIZER OPENS EVENT
    ↓
CREATE ZONES
    ↓
CREATE ROLES
    ↓
CREATE SHIFTS
    ↓
DEFINE REQUIRED SKILLS + HEADCOUNT
    ↓
ADD/MANAGE VOLUNTEERS
    ↓
SMART VOLUNTEER ASSIGNMENT
    ↓
CHECK-IN / TASKS / ISSUES
    ↓
LIVE COORDINATION DASHBOARD

The Events page should therefore display events that have actually been created inside the platform.

============================================================
2. INSPECT THE EXISTING PROJECT FIRST
============================================================

Before changing anything:

1. Inspect the complete existing project structure.
2. Identify:
   - frontend framework
   - backend framework
   - database
   - existing models
   - existing API routes
   - authentication
   - routing
   - styling system
   - reusable components
3. Reuse the existing architecture.
4. Do NOT unnecessarily rewrite working code.
5. Do NOT create duplicate models or duplicate APIs if equivalent functionality already exists.
6. Maintain compatibility with the existing project.

If an Event model/API already exists, extend it instead of creating another Event system.

============================================================
3. CREATE EVENT
============================================================

The organizer must be able to create an event through the application.

Create a proper "Create Event" page/modal.

Fields should include:

- Event name
- Description
- Cover image
- Category
- Date
- Start time
- End time
- Location
- Volunteer requirement
- Featured status

Use proper form validation.

When the organizer submits the form:

CREATE EVENT
    ↓
POST/API request
    ↓
Backend validation
    ↓
Database
    ↓
Return created event
    ↓
Refresh/update Events UI

Do NOT just store the event in frontend state.

It MUST persist in the database.

============================================================
4. EVENTS PAGE
============================================================

The Events page must fetch events from the backend/database.

For example:

GET /events

Use the actual API architecture already present in the project.

The page should dynamically render the events returned by the backend.

If there are:

0 events:

Show:

"No events yet"

"Create your first event to start coordinating volunteers."

[ + CREATE EVENT ]

Do NOT display placeholder events.

If there are 3 events:

Display exactly those 3 events.

If there are 50 events:

Display those 50 events using pagination/infinite scroll/appropriate loading if needed.

The number of cards must be determined by actual database data.

============================================================
5. VISUAL DESIGN
============================================================

Use the attached reference image as inspiration for the EVENTS PAGE.

We want a modern, premium, image-focused event browsing experience.

Visual characteristics:

- Dark background
- Large featured event
- Large event cover image
- Gradient overlay on featured image
- Event information over the image
- Circular category thumbnails
- Horizontal event-card sections
- Rounded corners
- Modern typography
- Subtle borders
- Subtle shadows
- Smooth hover animations
- Horizontal scrolling
- Strong visual hierarchy

DO NOT copy the branding, text, or content from the reference image.

Only use its layout/visual style as inspiration.

============================================================
6. FEATURED EVENT
============================================================

The large hero/featured section must also be dynamic.

DO NOT hardcode a featured event.

Use the `featured` field from the database.

If an event is marked as featured:

Display that event.

If no event is marked as featured:

Automatically select an appropriate upcoming event from the database.

If there are no events:

Show the empty state.

The featured section should display dynamically:

- Event image
- Event name
- Description
- Date
- Time
- Location
- Category
- Volunteer requirement

All values must come from the database.

============================================================
7. EVENT CARDS
============================================================

Each event card must be generated from backend data.

Card should display:

- Cover image
- Event name
- Category
- Date
- Time
- Location
- Volunteer requirement
- Current volunteer count
- Event status
- Favorite/action button if supported

Example STRUCTURE ONLY:

IMAGE

EVENT NAME

DATE • TIME

LOCATION

X / Y VOLUNTEERS

[VIEW EVENT]

IMPORTANT:

The above is only the UI structure.

Do NOT hardcode "X / Y" or any actual event values.

Calculate/display the real values from the database.

============================================================
8. EVENT CATEGORIES
============================================================

Do NOT hardcode category values into the UI if categories are stored dynamically.

Categories should be derived from the actual event data/database.

If the backend supports a category table, fetch categories from it.

The category navigation should filter the events dynamically.

Example behavior:

User clicks a category
        ↓
Filter/API request
        ↓
Display matching events

Do not simply hide/show a manually written list.

============================================================
9. EVENT DETAILS
============================================================

Clicking an event must open its actual details.

Route:

/events/:eventId

The event ID must come from the selected database record.

Fetch the event from the backend.

Display:

- Cover image
- Name
- Description
- Category
- Date
- Start/end time
- Location
- Volunteer requirement
- Current assigned volunteers
- Zones
- Roles
- Shifts
- Available volunteer opportunities

Do NOT pass around hardcoded event objects.

============================================================
10. EVENT-SPECIFIC MANAGEMENT
============================================================

Inside each event, the organizer should eventually be able to manage:

ZONES
- Create zone
- Edit zone
- Delete zone

ROLES
- Create role
- Required skill
- Required number of volunteers

SHIFTS
- Start time
- End time
- Required volunteers

TASKS
- Create task
- Assign task
- Status

ISSUES
- Create issue
- Zone
- Priority
- Status

All of these must be associated with the specific event ID.

For example:

event_id → zone
event_id → role
event_id → shift
event_id → task
event_id → issue

============================================================
11. VOLUNTEERS
============================================================

Volunteers must also come from the database.

DO NOT create fake volunteer objects in the frontend.

Volunteer information should include, where supported:

- Name
- Skills
- Availability
- Preferences
- Current workload
- Assignment status
- Check-in status

The event should show actual volunteers associated with that event.

============================================================
12. SMART ASSIGNMENT
============================================================

The core challenge of the problem statement is skill-based shift assignment.

Implement a simple but functional matching engine.

Consider:

- Skill match
- Availability
- Preference
- Workload fairness

The assignment engine should operate on actual database data.

Flow:

Event
↓
Roles + shifts
↓
Available volunteers
↓
Calculate match score
↓
Recommend/assign volunteers
↓
Save assignment to database

Do NOT use hardcoded assignment results.

The score must be calculated from the actual volunteer and role data.

============================================================
13. REPLACEMENT LOGIC
============================================================

If an assigned volunteer becomes unavailable:

1. Mark volunteer unavailable/absent.
2. Find suitable available volunteers from the database.
3. Calculate their match scores.
4. Suggest the best available replacements.
5. Allow organizer to assign the replacement.

Again, no hardcoded replacement names.

============================================================
14. DASHBOARD
============================================================

The dashboard must calculate statistics from the database.

Examples:

Total Events
Active Events
Total Volunteers
Checked-In Volunteers
Open Tasks
Completed Tasks
Open Issues
Staffing Gaps

DO NOT write numbers directly into the dashboard.

For example:

❌ "48 Volunteers"
❌ "12 Events"
❌ "3 Issues"

Instead calculate them from backend/database data.

If there is no data:

Show 0 or an appropriate empty state.

============================================================
15. LOADING / ERROR / EMPTY STATES
============================================================

Every data-driven section must handle:

Loading
Error
Empty data

Example:

Loading:
"Loading events..."

Error:
"Unable to load events. Try again."

Empty:
"No events created yet."

Never fall back to fake hardcoded data.

============================================================
16. IMAGE HANDLING
============================================================

Event cover images must come from the event's stored image reference.

Do NOT hardcode external image URLs into event cards.

Implement a proper upload/storage/reference mechanism using the project's existing backend architecture.

If an event has no image:

Display a generic UI fallback/placeholder.

Do NOT substitute a hardcoded event image.

============================================================
17. CREATE EVENT → LISTING FLOW
============================================================

THIS FLOW MUST WORK END-TO-END:

Organizer logs in
        ↓
Clicks "Create Event"
        ↓
Fills event form
        ↓
Uploads/selects cover image
        ↓
Submits
        ↓
Backend validates
        ↓
Event saved to database
        ↓
Events page fetches events
        ↓
New event appears automatically
        ↓
Organizer clicks event
        ↓
Event details load using event ID

This is the most important flow.

============================================================
18. DO NOT CREATE FAKE DATA
============================================================

ABSOLUTELY NO:

const events = [
   { name: "Example Event" }
]

or:

const volunteers = [
   ...
]

or:

const stats = {
   volunteers: 48
}

or fake API responses.

Do not hardcode fake data anywhere in production components.

If seed data is absolutely necessary for development, create it through the backend/database seed mechanism, clearly separated from production UI logic.

The frontend must always consume API/database data.

============================================================
19. RESPONSIVENESS
============================================================

Desktop:
- Large featured event
- Multiple event cards
- Horizontal scrolling sections

Tablet:
- Fewer cards per row
- Horizontal scrolling

Mobile:
- Responsive featured card
- Swipeable event rows
- Mobile-friendly navigation
- Proper image scaling

============================================================
20. CODE QUALITY
============================================================

Use:

- reusable components
- clean folder structure
- API/service layer
- reusable EventCard
- reusable EventSection
- reusable EventForm
- reusable EmptyState
- reusable LoadingState
- reusable ErrorState

Do not duplicate event-card markup.

Do not put business logic directly into presentation components if it can be separated.

============================================================
21. FINAL ACCEPTANCE CRITERIA
============================================================

Before saying the implementation is complete, verify:

[ ] No hardcoded event data exists in frontend components.

[ ] Organizer can create an event.

[ ] Event is persisted to database.

[ ] Newly created event appears automatically on Events page.

[ ] Events page works when database contains 0 events.

[ ] Featured event is dynamic.

[ ] Event cards are dynamic.

[ ] Event details use actual event ID.

[ ] Categories/filtering use actual data.

[ ] Event-specific zones/roles/shifts use event IDs.

[ ] Dashboard statistics come from actual data.

[ ] Volunteer data comes from database.

[ ] Smart assignment uses actual volunteer/role data.

[ ] No fake numbers are displayed.

[ ] No fake names are displayed.

[ ] No fake images are displayed.

[ ] No fake API responses are used.

[ ] Loading states work.

[ ] Error states work.

[ ] Empty states work.

[ ] Responsive layout works.

[ ] No console errors.

[ ] Existing functionality has not been unnecessarily broken.

============================================================
FINAL DESIGN INTENT
============================================================

The reference image represents ONLY the visual direction.

The final product should feel like:

PREMIUM EVENT DISCOVERY
+
EVENT MANAGEMENT
+
VOLUNTEER COORDINATION
+
SMART ASSIGNMENT

The organizer creates the data.

The database stores the data.

The frontend displays the data.

Nothing important should be hardcoded.

START BY INSPECTING THE EXISTING CODEBASE, THEN IMPLEMENT THIS SYSTEM USING THE EXISTING ARCHITECTURE.