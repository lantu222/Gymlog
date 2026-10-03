import { AppLanguage } from '../types/models';
import { ANALYTICS_RETENTION_MONTHS } from './analyticsRetention';
import { t } from './i18n';
import { LEGAL_ENTITY } from './legalDocuments';

/**
 * The public "delete your account" page — the URL Play's Data safety form asks
 * for. Play counts Google sign-in as an account, so the page is required even
 * though signing in is optional.
 *
 * Every button name is read from the app's own strings, so a renamed button
 * renames the page too. What is deleted and what stays repeats the privacy
 * policy's "Delete account" paragraph; keep the two saying the same thing.
 */
export type AccountDeletionPage = {
  title: string;
  summary: string;
  sections: { heading: string; body?: string[]; steps?: string[]; bullets?: string[] }[];
};

/** Apple sign-in markers are cleared once this many days have passed (api/backup.ts APPLE_SESSION_DAYS). */
export const APPLE_DELETION_MARKER_DAYS = 180;

/** Section labels are upper case in the app; the page names them as words. */
function sectionName(language: AppLanguage, key: 'settings.section.dangerZone'): string {
  const label = t(language, key);
  return label.charAt(0) + label.slice(1).toLocaleLowerCase(language === 'fi' ? 'fi-FI' : 'en-GB');
}

export function buildAccountDeletionPage(language: AppLanguage): AccountDeletionPage {
  const profile = t(language, 'tabs.profile');
  const settings = t(language, 'settings.title');
  const dangerZone = sectionName(language, 'settings.section.dangerZone');
  const deleteAccount = t(language, 'account.deleteAccount');
  const deleteRemote = t(language, 'account.deleteRemote');
  const resetAll = t(language, 'settings.resetData');
  const months = ANALYTICS_RETENTION_MONTHS;
  const days = APPLE_DELETION_MARKER_DAYS;
  const { name, email } = LEGAL_ENTITY;

  if (language === 'fi') {
    return {
      title: 'Vinha – tilin ja tietojen poisto',
      summary: `Vinha-sovelluksen julkaisija on ${name}. Näin poistat Vinha-tilisi ja palvelimellamme olevat tietosi.`,
      sections: [
        {
          heading: 'Poista tili sovelluksessa',
          steps: [
            'Avaa Vinha ja kirjaudu sisään samalla Google- tai Apple-tilillä, jolla otit varmuuskopion.',
            `Avaa ${profile}-välilehti ja paina oikean yläkulman ratasta (${settings}).`,
            `Vieritä kohtaan ${dangerZone} ja paina ${deleteAccount}.`,
            'Vahvista. Poisto tehdään heti.',
          ],
          body: [
            'Jos puhelinta ei enää ole, asenna Vinha mihin tahansa puhelimeen, kirjaudu samalla tilillä ja tee sama.',
          ],
        },
        {
          heading: 'Mitä poistetaan',
          bullets: [
            'Pilvivarmuuskopio: profiilisi, treeniloki, ohjelmat ja kehon mittaukset — kaikki, mitä sovellus oli varmuuskopioinut.',
            'AI-valmentajan kopiot kysymyksistäsi, ohjelmistasi ja kuvistasi, jos olit sallinut niiden säilyttämisen.',
            'Apple-tilillä: palvelimemme antamat kirjautumiset. Muut puhelimesi kirjautuvat ulos seuraavalla yhteydellään.',
          ],
        },
        {
          heading: 'Mitä jää ja kuinka kauan',
          bullets: [
            `Treenitiedot puhelimessasi, kunnes painat ${resetAll} tai poistat sovelluksen.`,
            `Nimettömät käyttötilastot ja virheraportit, enintään ${months} kuukautta. Niitä ei ole sidottu tiliisi, joten niistä ei voi poimia sinun tietojasi.`,
            `Apple-tilillä yksi merkintä päivämäärineen, joka estää vanhan kirjautumisen käytön. Siinä ei ole nimeä, sähköpostia eikä treenitietoja, ja se poistuu ${days} päivän jälkeen.`,
            'Anthropic, joka kirjoittaa valmentajan vastaukset, poistaa oman kopionsa kysymyksistä 30 päivän kuluessa joka tapauksessa.',
          ],
        },
        {
          heading: 'Vain varmuuskopion poisto',
          body: [
            `${deleteRemote} samassa kohdassa poistaa palvelinkopion mutta pitää sinut kirjautuneena.`,
          ],
        },
        {
          heading: 'Kysymykset',
          body: [
            `Kirjoita osoitteeseen ${email}. Palvelimelle ei tallenneta nimeäsi eikä sähköpostiasi, joten emme löydä tietojasi pelkän osoitteen perusteella — poisto sovelluksessa on ainoa tapa yksilöidä tilisi.`,
          ],
        },
      ],
    };
  }

  return {
    title: 'Vinha – delete your account and data',
    summary: `Vinha is published by ${name}. This is how you delete your Vinha account and the data on our server.`,
    sections: [
      {
        heading: 'Delete your account in the app',
        steps: [
          'Open Vinha and sign in with the same Google or Apple account you backed up with.',
          `Open the ${profile} tab and tap the gear in the top right corner (${settings}).`,
          `Scroll to ${dangerZone} and tap ${deleteAccount}.`,
          'Confirm. The deletion happens immediately.',
        ],
        body: [
          'If you no longer have the phone, install Vinha on any phone, sign in with the same account and do the same.',
        ],
      },
      {
        heading: 'What is deleted',
        bullets: [
          'The cloud backup: your profile, training log, programmes and body measurements — everything the app had backed up.',
          'The AI coach’s copies of your questions, programmes and photos, if you had allowed us to keep them.',
          'For an Apple account: the sign-ins our server issued. Your other phones are signed out the next time they connect.',
        ],
      },
      {
        heading: 'What stays, and for how long',
        bullets: [
          `The training data on your phone, until you tap ${resetAll} or uninstall the app.`,
          `Anonymous usage statistics and error reports, for up to ${months} months. They are not tied to your account, so nothing of yours can be picked out of them.`,
          `For an Apple account, one dated marker that stops an old sign-in from being used. It holds no name, email or training data, and is removed after ${days} days.`,
          'Anthropic, which writes the coach’s answers, deletes its own copy of the questions within 30 days either way.',
        ],
      },
      {
        heading: 'Deleting only the backup',
        body: [`${deleteRemote}, in the same place, removes the server copy and keeps you signed in.`],
      },
      {
        heading: 'Questions',
        body: [
          `Write to ${email}. Our server stores neither your name nor your email, so we cannot find your data from an address alone — deleting in the app is the only way to identify your account.`,
        ],
      },
    ],
  };
}
