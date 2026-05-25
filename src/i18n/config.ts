import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { esResources } from '../modules/es/i18n/resources';
import { mysqlResources } from '../modules/mysql/i18n/resources';
import { redisResources } from '../modules/redis/i18n/resources';
import { sharedResources } from './resources/shared';

// Get saved language from local storage or default to 'zh'
const savedLanguage = localStorage.getItem('language') || 'zh';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      zh: {
        translation: {
          ...sharedResources.zh,
          ...esResources.zh,
          ...mysqlResources.zh,
          ...redisResources.zh
        }
      },
      en: {
        translation: {
          ...sharedResources.en,
          ...esResources.en,
          ...mysqlResources.en,
          ...redisResources.en
        }
      }
    },
    lng: savedLanguage,
    fallbackLng: 'zh',
    interpolation: {
      escapeValue: false // React already protects from XSS
    }
  });

// Save language preference when it changes
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('language', lng);
});

export default i18n;
