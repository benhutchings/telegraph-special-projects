/**
 * Rebuild the Netlify site shortly after the Google Sheet is edited.
 *
 * Edits only mark the sheet as "changed". A timer checks every minute and
 * triggers one Netlify build once nobody has edited for QUIET_MINUTES, so a
 * burst of typing produces a single deploy rather than one per cell.
 *
 * Setup (once, by someone with edit access to the sheet):
 *   1. In the sheet: Extensions → Apps Script. Paste this file in, replacing Code.gs.
 *   2. Click the gear icon in the editor's far-left sidebar (Project Settings),
 *      scroll to Script Properties → Add script property:
 *        NETLIFY_BUILD_HOOK = <the Netlify build hook URL>
 *   3. Back in the editor (< > icon), choose `setup` in the function dropdown
 *      next to Run, and click Run. Approve the permissions prompt (it needs to
 *      call an external URL and run on a timer).
 *   No deployment is needed: ignore the Deploy button.
 *
 * Run `setup` again any time to reset the triggers. Run `rebuildNow` to deploy
 * immediately.
 */

const QUIET_MINUTES = 2;

/** Installs the triggers. Safe to run more than once. */
function setup() {
  if (!getHook_()) {
    throw new Error('Add the NETLIFY_BUILD_HOOK script property first (Project Settings → Script Properties).');
  }
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  const sheet = SpreadsheetApp.getActive();
  // onEdit: cell edits. onChange: inserting/deleting rows, columns or tabs.
  ScriptApp.newTrigger('markChanged').forSpreadsheet(sheet).onEdit().create();
  ScriptApp.newTrigger('markChanged').forSpreadsheet(sheet).onChange().create();
  ScriptApp.newTrigger('rebuildIfQuiet').timeBased().everyMinutes(1).create();
  Logger.log('Triggers installed. Edits will rebuild the site after %s quiet minutes.', QUIET_MINUTES);
}

/** Called on every edit/change: records that a rebuild is due. */
function markChanged() {
  PropertiesService.getScriptProperties().setProperty('LAST_EDIT', String(Date.now()));
}

/** Called every minute: rebuilds once edits have stopped for QUIET_MINUTES. */
function rebuildIfQuiet() {
  const props = PropertiesService.getScriptProperties();
  const lastEdit = Number(props.getProperty('LAST_EDIT') || 0);
  if (!lastEdit || Date.now() - lastEdit < QUIET_MINUTES * 60 * 1000) return;

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    // Re-read inside the lock; clear only if no newer edit arrived meanwhile.
    if (props.getProperty('LAST_EDIT') !== String(lastEdit)) return;
    trigger_('Sheet edited');
    props.deleteProperty('LAST_EDIT');
  } finally {
    lock.releaseLock();
  }
}

/** Run by hand to deploy straight away. */
function rebuildNow() {
  trigger_('Manual rebuild from sheet');
  PropertiesService.getScriptProperties().deleteProperty('LAST_EDIT');
}

function trigger_(title) {
  const hook = getHook_();
  if (!hook) throw new Error('NETLIFY_BUILD_HOOK script property is not set.');
  const res = UrlFetchApp.fetch(hook + '?trigger_title=' + encodeURIComponent(title), {
    method: 'post',
    payload: '{}',
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code >= 300) throw new Error('Netlify build hook returned HTTP ' + code + ': ' + res.getContentText());
  Logger.log('Triggered Netlify build (%s).', title);
}

function getHook_() {
  return PropertiesService.getScriptProperties().getProperty('NETLIFY_BUILD_HOOK');
}
