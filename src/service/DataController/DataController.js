import { AuthPopup } from 'Components/AuthPopup';
import moment from 'moment';
import {
  openAuthPopup,
  closeAuthPopup,
  authPopupState,
  userDataStore,
  showAuthReport,
} from 'Service/AppState';
import {
  apiGetWords,
  apiUserSettingsPut,
  apiUserSettingsGet,
  apiUserCreate,
  apiUserSignIn,
  apiUserWordsSave,
  apiUserWordsGet,
  apiUserAggregatedWords,
  apiWordMaterialsGet,
} from 'Service/ServerAPI';
import { reportMessages } from './reportMessages';
import {
  dataControllerConst,
  cardDefaultSettingsTemplate,
  cardShortStatTemplate,
} from './dataControllerConst';

const authPopup = new AuthPopup();

export class DataController {
  constructor() {
    authPopup.init();

    userDataStore.watch((userData) => {
      if (this.isAuthInProgress) {
        if (userData.statusRegister) {
          this.authChainResponsibility = this.chainCreateSignInSettingsGet;
        }
        this.authChainResponsibility(userData);
      }
    });

    authPopupState.watch((state) => {
      if (state) {
        showAuthReport(reportMessages.default.welcome);
        this.isAuthInProgress = true;
      } else if (this.isAuthInProgress) {
        this.isAuthInProgress = false;
        this.reject(dataControllerConst.cancelUser);
      }
    });
  }

  getWordMaterials(wordId) {
    return apiWordMaterialsGet(wordId).then((wordMaterials) => {
      const materials = {
        image: dataControllerConst.imageBase64Prifex.concat(wordMaterials.image),
        audio: dataControllerConst.audioBase64Prifex.concat(wordMaterials.audio),
        audioExample: dataControllerConst.audioBase64Prifex.concat(wordMaterials.audioExample),
        audioMeaning: dataControllerConst.audioBase64Prifex.concat(wordMaterials.audioMeaning),
      };

      return { ...wordMaterials, ...materials };
    });
  }

  userWordsGetAll(groupWords) {
    return apiUserAggregatedWords(groupWords);
  }

  userWordsGet(wordId) {
    return apiUserWordsGet(wordId);
  }

  userWordsPut({ status = 'onlearn', id, progress = 0 }) {
    const sendWordData = {
      difficulty: status,
      optional: {
        lastDate: new Date().toDateString(),
        progress,
      },
    };
    return apiUserWordsSave(id, sendWordData, 'PUT');
  }

  userWordsPost({ status = 'onlearn', id, progress = 0 }) {
    const sendWordData = {
      difficulty: status,
      optional: {
        lastDate: new Date().toDateString(),
        progress,
      },
    };
    return apiUserWordsSave(id, sendWordData, 'POST');
  }

  getMaterials(file) {
    return new Promise((resolve) => {
      resolve(`${dataControllerConst.materialPath}${file}`);
    });
  }

  getWords(options) {
    return apiGetWords({ ...dataControllerConst.defaultZeroBlock, ...options });
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

  setUserStatistics(statisticsData) {
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
      this.userStatisticUpload = statisticsData;

      if (this.checkToken()) {
        apiUserSettingsGet('statistics')
          .then((currentStatistics) =>
            apiUserSettingsPut(
              this.prepareUploadStatistics(currentStatistics, statisticsData),
              'statistics',
            ),
          )
          .then(
            (data) => resolve(this.orderingStatResult(data)),
            (rejectReport) => reject(rejectReport),
          );
      } else {
        // temp cover - TODO algorithm for auth
        // eslint-disable-next-line prefer-promise-reject-errors
        reject({ message: 'user not defined' });
      }
    });
  }

  getUserStatistics() {
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;

      if (this.checkToken()) {
        apiUserSettingsGet('statistics').then(
          (userStatistics) => {
            resolve(this.orderingStatResult(userStatistics));
          },
          (rejectReport) => reject(rejectReport),
        );
      } else {
        // temp cover - TODO algorithm for auth
        // eslint-disable-next-line prefer-promise-reject-errors
        reject({ message: 'user not defined' });
      }
    });
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

  chainCreateSignInSettingsGet(userData) {
    const userSettingsName = {
      optional: this.packUserSettings({
        settings: cardDefaultSettingsTemplate,
        name: userData.name,
      }),
    };
    apiUserCreate(userData)
      .then(() => apiUserSignIn(userData))
      .then(() => apiUserSettingsPut({ learnedWords: 0 }, 'statistics'))
      .then(() => apiUserSettingsPut(userSettingsName))
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

  orderingStatResult(userStatistics) {
    const statisticsItems = ['savanna', 'audition', 'puzzle', 'sprint', 'speak-it', 'match-it'];
    const { learnedWords = 0, optional = {} } = userStatistics;
    const today = moment().format('DD-MMM-YYYY');
    const shortStat = { ...cardShortStatTemplate, ...{ date: today } };
    const originStatistics = {
      ...this.unpackUserSettings(optional),
    };
    originStatistics.card = originStatistics.card ?? { shortTime: shortStat, longTime: [] };
    statisticsItems.forEach((item) => {
      originStatistics[item] = originStatistics[item] ?? { longTime: [] };
    });
    originStatistics.learnedWords = learnedWords;

    return originStatistics;
  }

  findTopStatistics(topList, currentResult) {
    let nextFindPosition = currentResult;

    const topResult = topList.map((topPosition) => {
      if (nextFindPosition.result >= topPosition.result) {
        const returnItem = nextFindPosition;
        nextFindPosition = topPosition;
        return returnItem;
      }
      return topPosition;
    });

    if (topResult.length < 5) {
      topResult.push(nextFindPosition);
    }

    return topResult;
  }

  cardStatisticsAggregate(originStatOptionalCard, shortTimeStat, today) {
    const shortStat = { ...cardShortStatTemplate, ...{ date: today } };
    const { longTime = [], shortTime = shortStat } = originStatOptionalCard;
    const resultOptionalCard = {
      longTime,
      shortTime,
    };

    if (shortTime.date !== today) {
      const longTimeStatItem = [shortTime.date, shortTime.newWords];
      resultOptionalCard.longTime.push(longTimeStatItem);
      resultOptionalCard.shortTime = { ...shortStat, ...shortTimeStat };
    }
    return resultOptionalCard;
  }

  prepareUploadStatistics(originStatistics, uploadStatistics) {
    const today = moment().format('DD-MMM-YYYY');
    const { optional = {} } = originStatistics;
    const tempStatisticsObject = {
      optional: this.unpackUserSettings(optional),
    };

    if (uploadStatistics.card) {
      tempStatisticsObject.optional.card = this.cardStatisticsAggregate(
        tempStatisticsObject.optional.card,
        uploadStatistics.card,
        today,
      );
      const { longTime } = tempStatisticsObject.optional.card;
      tempStatisticsObject.learnedWords = longTime.reduce((summ, value) => summ + value[1], 0);
    } else {
      Object.keys(uploadStatistics).forEach((key) => {
        const todayAsObj = { date: today };
        const statisticsItem = { ...uploadStatistics[key], ...todayAsObj };
        if (optional[key]) {
          tempStatisticsObject.optional[key].longTime.push(statisticsItem);
          tempStatisticsObject.optional[key].top = this.findTopStatistics(
            tempStatisticsObject.optional[key].top,
            statisticsItem,
          );
        } else {
          tempStatisticsObject.optional[key] = {
            longTime: [statisticsItem],
            top: [statisticsItem],
          };
        }
      });
    }

    tempStatisticsObject.optional = this.packUserSettings(tempStatisticsObject.optional);
    return tempStatisticsObject;
  }

  prepareUploadSetting(originSettings, uploadSettings) {
    return {
      optional: this.packUserSettings({
        ...this.unpackUserSettings(originSettings.optional),
        ...uploadSettings,
      }),
    };
  }

  unpackUserSettings(userSettings) {
    const resultUserSettings = {};
    Object.keys(userSettings).forEach((field) => {
      resultUserSettings[field] = JSON.parse(userSettings[field]);
    });
    return resultUserSettings;
  }

  packUserSettings(userSettings) {
    const resultUserSettings = {};
    Object.keys(userSettings).forEach((field) => {
      resultUserSettings[field] = JSON.stringify(userSettings[field]);
    });
    return resultUserSettings;
  }
}
