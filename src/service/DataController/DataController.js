import { AuthPopup } from 'Components/AuthPopup';
import {
  openAuthPopup,
  closeAuthPopup,
  authPopupState,
  userDateStore,
  showAuthReport,
} from 'Service/AppState';
import {
  apiGetWords,
  apiUserSettingsPut,
  apiUserSettingsGet,
  apiUserCreate,
  apiUserSignIn,
} from 'Service/ServerAPI';
import { reportMessages } from './reportMessages';

const CANCEL_USER = {
  status: 0,
  message: 'User refused',
  name: 'Unknown',
};

const authPopup = new AuthPopup();
const defaultZeroBlock = { page: 0, group: 0 };

export class DataController {
  constructor() {
    authPopup.init();

    userDateStore.watch((userData) => {
      if (this.isAuthInProgress) {
        this.authChainResponsibility(userData);
      }
    });

    authPopupState.watch((state) => {
      if (state) {
        showAuthReport(reportMessages.default.welcome);
        this.isAuthInProgress = true;
      } else if (this.isAuthInProgress) {
        this.isAuthInProgress = false;
        this.reject(CANCEL_USER);
      }
    });
  }

  getWords(options) {
    return apiGetWords({ ...defaultZeroBlock, ...options });
  }

  logoutUser() {
    localStorage.setItem('token', '');
  }

  getUser() {
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;

      if (this.checkToken()) {
        apiUserSettingsGet().then(
          (userSettings) => resolve(this.unpackUserSettings(userSettings.optional)),
          () => {
            this.authChainResponsibility = this.chainSignInSettingsGet;
            openAuthPopup();
          },
        );
      } else {
        this.authChainResponsibility = this.chainSignInSettingsGet;
        openAuthPopup();
      }
    });
  }

  setUserOptions(userSettingsUpload) {
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
      this.userSettingsUpload = userSettingsUpload;

      if (this.checkToken()) {
        apiUserSettingsGet()
          .then((userSettingsOrigin) =>
            apiUserSettingsPut(
              this.prepareUploadSetting(userSettingsOrigin, this.userSettingsUpload),
            ),
          )
          .then(
            (userSettings) => resolve(this.unpackUserSettings(userSettings.optional)),
            (rejectReport) => reject(rejectReport),
          );
      } else {
        this.authChainResponsibility = this.chainSignInSettingsGetSettingsPut;
        openAuthPopup();
      }
    });
  }

  prepareUploadSetting(originSettings, uploadSettings) {
    return {
      optional: this.packUserSettings({
        ...this.unpackUserSettings(originSettings.optional),
        ...uploadSettings,
      }),
    };
  }

  chainSignInSettingsGetSettingsPut(userData) {
    apiUserSignIn(userData)
      .then(() => apiUserSettingsGet())
      .then((userSettingsOrigin) =>
        apiUserSettingsPut(this.prepareUploadSetting(userSettingsOrigin, this.userSettingsUpload)),
      )
      .then(
        (userSettings) => {
          this.isAuthInProgress = false;
          closeAuthPopup();
          this.resolve(this.unpackUserSettings(userSettings.optional));
        },
        (rejectReport) => {
          showAuthReport(reportMessages[rejectReport.master][rejectReport.code]);
        },
      );
  }

  chainSignInSettingsGet(userData) {
    apiUserSignIn(userData)
      .then(() => apiUserSettingsGet())
      .then(
        (userSettings) => {
          this.isAuthInProgress = false;
          closeAuthPopup();
          this.resolve(this.unpackUserSettings(userSettings.optional));
        },
        (rejectReport) => {
          showAuthReport(reportMessages[rejectReport.master][rejectReport.code]);
        },
      );
  }

  checkToken() {
    const { userId, token } = localStorage;
    if (userId && token) {
      return true;
    }
    return false;
  }

  unpackUserSettings(userSettings) {
    const resultUserSettings = {};
    for (const field in userSettings) {
      resultUserSettings[field] = JSON.parse(userSettings[field]);
    }
    return resultUserSettings;
  }

  packUserSettings(userSettings) {
    const resultUserSettings = {};
    for (const field in userSettings) {
      resultUserSettings[field] = JSON.stringify(userSettings[field]);
    }
    return resultUserSettings;
  }
}
