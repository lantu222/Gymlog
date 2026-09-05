const assert = require('node:assert/strict');

const { routeForNotification } = require('../../.test-dist/lib/notificationRoute.js');
const fs = require('node:fs');
const path = require('node:path');

const appWiring = require('../helpers/appWiringSource.cjs').readAppWiring();
const handlerSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'utils', 'notificationHandler.ts'),
  'utf8',
);
const schedulerSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'utils', 'appNotifications.ts'),
  'utf8',
);

/** What the scheduler stamps on its own notifications. */
const PLAN = { gymlogPlan: true };

module.exports = [
  {
    /**
     * The report: tapping "Uusi ennätys" opened the activity calendar. It was
     * not a wrong destination — nothing read the tap at all, so the app
     * resumed the screen it had been left on, which happened to be the
     * calendar (#bugs 2026-09-05).
     */
    name: 'a record notification opens the records page',
    run() {
      assert.deepEqual(routeForNotification({ ...PLAN, category: 'record' }), {
        tab: 'progress',
        screen: 'list',
        section: 'records',
      });
    },
  },
  {
    name: 'a reminder that asks for a number opens where the number is entered',
    run() {
      assert.deepEqual(routeForNotification({ ...PLAN, category: 'weighIn' }), {
        tab: 'progress',
        screen: 'list',
        section: 'measures',
        measure: 'bodyweight',
      });
      // The weekly one NAMES a measurement, so it opens on that one — the
      // same reason the route grew `measure` for the Home stat cards.
      assert.deepEqual(routeForNotification({ ...PLAN, category: 'measure', measureKind: 'hips' }), {
        tab: 'progress',
        screen: 'list',
        section: 'measures',
        measure: 'hips',
      });
      // A kind that did not travel still lands on the list rather than nowhere.
      assert.deepEqual(routeForNotification({ ...PLAN, category: 'measure' }), {
        tab: 'progress',
        screen: 'list',
        section: 'measures',
      });
    },
  },
  {
    name: 'the week in review opens the overview; "come and train" opens Home',
    run() {
      assert.equal(routeForNotification({ ...PLAN, category: 'weekly' }).section, 'overview');
      assert.deepEqual(routeForNotification({ ...PLAN, category: 'comeback' }), { tab: 'home', screen: 'dashboard' });
      assert.deepEqual(routeForNotification({ ...PLAN, category: 'reminder' }), { tab: 'home', screen: 'dashboard' });
    },
  },
  {
    /**
     * A notification still pending from an older build can carry a category
     * this one has never heard of. Null leaves the app where it is, which is
     * the behaviour every notification had until today — wrong to keep as the
     * rule, right to keep as the fallback.
     */
    name: 'a notification this build does not understand moves nothing',
    run() {
      assert.equal(routeForNotification({ ...PLAN, category: 'streak-o-meter' }), null);
      assert.equal(routeForNotification({ ...PLAN }), null);
      // A rest-timer notification is not the planner's, and its tap belongs to
      // the OTHER listener — the one that drives the running workout.
      assert.equal(routeForNotification({ gymlogRest: true, category: 'record' }), null);
      assert.equal(routeForNotification({ category: 'record' }), null, 'unmarked data steered the route');
      assert.equal(routeForNotification(null), null);
      assert.equal(routeForNotification('record'), null);
      assert.equal(routeForNotification(undefined), null);
    },
  },
  {
    /**
     * And the app has to LISTEN. The mapping is inert on its own — that was
     * the whole bug, so a test that only exercises the function would have
     * passed against the broken build.
     */
    name: 'the app reads notification taps, cold start included',
    run() {
      // NOT `assert.match(appWiring, /addNotificationResponseReceivedListener/)`:
      // the rest timer has had one of those since long before this, so that
      // assertion passed against the broken build. Every line below names
      // something only the planner's handler does.
      assert.match(appWiring, /routeForNotification\(response\.notification\.request\.content\.data\)/);
      // The cold start: the tap launched the process, and the listener is
      // attached long after the response was delivered. Read once and then
      // CLEARED — the stored response outlives the launch it belongs to, so
      // reading without clearing answers every later cold start with the same
      // tap and the app reopens on Records forever (found in review,
      // 2026-09-05). The async pair is deprecated in expo-notifications 55.
      assert.match(appWiring, /Notifications\.getLastNotificationResponse\(\)/);
      assert.match(appWiring, /Notifications\.clearLastNotificationResponse\(\)/);
      assert.doesNotMatch(appWiring, /getLastNotificationResponseAsync/);
      // Held until the store is loaded, like the widget's target — a route
      // reset into a half-built app lands somewhere about to re-render.
      assert.match(appWiring, /if \(!appHydrated \|\| !pendingNotificationRoute\)/);
      assert.match(appWiring, /resetToRoute\(pendingNotificationRoute\)/);
      // And the older listener still guards its own notifications, so merging
      // the two cannot quietly hand rest actions to the router.
      assert.match(appWiring, /data\[SESSION_NOTIFICATION_MARKER\] !== true/);
      // The marker is copied into the pure module; this is the copy's leash.
      assert.match(handlerSource, /PLAN_NOTIFICATION_MARKER = 'gymlogPlan'/);

      /*
       * And the wire BETWEEN the two ends. The planner sets measureKind and
       * the router reads it, and both of those have their own test — but the
       * scheduler in the middle is what actually puts it on the notification,
       * and deleting that line broke the feature with every other guard still
       * green (found by mutating it, 2026-09-05). It cannot be required from
       * Node: expo-notifications.
       */
      assert.match(schedulerSource, /category: item\.category,/);
      assert.match(schedulerSource, /measureKind: item\.measureKind,/);
      assert.match(schedulerSource, /\[PLAN_NOTIFICATION_MARKER\]: true,/);
    },
  },
];
