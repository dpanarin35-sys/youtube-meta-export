# YouTube Meta Exporter

Node.js-приложение для входа через Google, просмотра всех роликов YouTube-канала и выгрузки подробных метаданных выбранных видео или всего канала в JSON/CSV.

Пользователи **не включают YouTube Data API сами**. API включается один раз в Google Cloud-проекте владельца приложения, а затем каждый пользователь лишь подтверждает OAuth-доступ к своему каналу.

## Установка и запуск

```powershell
npm install
Copy-Item .env.example .env
npm start
```

Откройте `http://localhost:3000`.

Перед запуском укажите настоящий OAuth Client ID в `.env`:

```env
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
PORT=3000
```

`.env` не попадает в Git. Client ID не является секретом и безопасно передаётся браузеру; Client Secret не требуется и не должен добавляться в проект.

Если в корне проекта лежит ровно один JSON-файл Google с именем вида `client_secret_*.json`, сервер автоматически возьмёт из него только `client_id`. Файл закрыт от HTTP-доступа и исключён из Git. Предпочтительный вариант для деплоя — всё же переменная `GOOGLE_CLIENT_ID` в `.env` или в настройках хостинга.

Для разработки с автоматической перезагрузкой сервера используйте `npm run dev`.

## Однократная настройка Google Cloud

1. Создайте проект в [Google Cloud Console](https://console.cloud.google.com/).
2. В **APIs & Services → Library** включите **YouTube Data API v3**.
3. В **OAuth consent screen** заполните сведения о приложении. Пока статус `Testing`, доступ будет только у добавленных тестовых пользователей. Для обычных пользователей переведите приложение в `In production`; Google может запросить верификацию, поскольку используется YouTube OAuth scope.
4. В **Credentials → Create credentials → OAuth client ID** выберите **Web application**.
5. В **Authorized JavaScript origins** добавьте `http://localhost:3000`. Для опубликованной версии добавьте и её точный HTTPS-домен.
6. Скопируйте Client ID в `.env`.

## Деплой

Для публикации приложение можно запустить на любом Node-хостинге. Укажите переменные окружения `GOOGLE_CLIENT_ID` и `PORT` в панели хостинга и добавьте боевой HTTPS-домен в Google Cloud OAuth origins. Не публикуйте `.env`.

### GitHub Pages

Проект также готов к статическому деплою через GitHub Pages: workflow `.github/workflows/deploy-pages.yml` публикует только HTML, CSS и JavaScript. Node-сервер, `.env`, `node_modules` и `client_secret_*.json` в артефакт не входят.

1. В репозитории откройте **Settings → Secrets and variables → Actions → Variables** и создайте переменные: `GOOGLE_CLIENT_ID`, `APP_NAME`, `APP_OPERATOR`, `CONTACT_EMAIL`. Они попадут в публичный `config.js`; не добавляйте туда Client Secret.
2. В **Settings → Pages** выберите **Source: GitHub Actions**.
3. Запустите workflow **Deploy static site to GitHub Pages** или отправьте изменения в ветку `main`.
4. В Google Cloud добавьте `https://<ваш-github-логин>.github.io` в **Authorized JavaScript origins**. Важно: origin содержит только протокол и домен, без имени репозитория. Для собственного домена добавьте его отдельной строкой.

Локальная Node-версия продолжает работать через `npm start`. Для статического локального просмотра можно скопировать `config.js.example` в `config.js` и указать в нём только публичный Client ID.

## Подготовка к YouTube API audit и увеличению квоты

Перед подачей заполните в `.env` переменные `APP_NAME`, `APP_OPERATOR` и `CONTACT_EMAIL`: они выводятся на публичных страницах Privacy Policy и Terms. Разместите приложение на HTTPS-домене, добавьте его в OAuth **Authorized JavaScript origins** и проверьте, что пользователь может открыть:

- `/privacy.html` — политика конфиденциальности, описание данных, удаления и контакта;
- `/terms.html` — условия использования и ссылка на условия YouTube;
- стартовую страницу — явное согласие с обеими политиками до OAuth;
- экран после входа — кнопку «Отозвать доступ и удалить данные».

Для формы YouTube подготовьте скриншоты главной страницы, Privacy Policy, Terms, OAuth consent screen со scope `youtube.force-ssl`, процесса отзыва доступа и экспорта. В описании укажите, что сервер не хранит YouTube-данные и что тексты субтитров выгружаются только после явного выбора пользователя. Для 771 ролика с одной дорожкой субтитров запросите около 250 000 единиц квоты в сутки.

## Экспортируемые данные

Сначала приложение считывает uploads-плейлист канала и выводит все ролики. В момент экспорта оно повторно запрашивает `videos.list` пачками до 50 ID, поэтому статистика свежая. JSON сохраняет исходную вложенную структуру ответа YouTube Data API; CSV разворачивает простые поля в колонки.

Для каждого экспортируемого видео приложение добавляет поле `captionTracks` со сведениями о доступных дорожках субтитров: язык, имя, тип, статус, черновик и ID дорожки. Если включён переключатель «Включить текст субтитров», каждая дорожка также содержит `subtitleText` в формате SRT. Это отдельный запрос `captions.list` (50 единиц квоты на ролик) и `captions.download` (200 единиц квоты на дорожку), поэтому большой экспорт с текстами субтитров заметно расходует дневную квоту Google Cloud.
