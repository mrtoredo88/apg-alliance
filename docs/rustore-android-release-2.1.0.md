# RuStore Android release candidate 2.1.0

Status: local release candidate. Do not upload or publish without final owner approval.

## Release identity

- Package: `ru.myapg.app`
- Version: `2.1.0`
- Version code: `20100`
- Previous moderated version: `2.0.0` (`20000`)
- RuStore Push project: `I8pESpf4UeWxkCYrWrDdSO-wfps2-Fne`

## RuStore description

Обновили главную страницу приложения: теперь рядом с вами проще находить интересные места, акции, события, новости и экспертов.

Также в новой версии:

- улучшена авторизация по почте и через Telegram;
- повышена стабильность сессии — приложение реже просит войти повторно;
- исправлено отображение отзывов у партнёров и экспертов;
- улучшены фильтры афиши «Сегодня», «Завтра» и «На выходных»;
- партнёры и эксперты могут управлять своими публикациями;
- в кабинете партнёра появились QR-коды и ссылки для приглашений, начисления ключей и создания плаката;
- добавлен удобный переключатель уведомлений;
- исправлены небольшие ошибки и улучшена стабильность приложения.

## Short description

Новая главная, стабильная авторизация, правильные отзывы и улучшенные кабинеты партнёров и экспертов.

## Validation checklist

- Run Android, authentication, notification, QR and referral automated tests.
- Build the current web bundle and synchronize it into the Android project.
- Build release AAB and APK.
- Verify that both artifacts report version `2.1.0 (20100)`.
- Verify the APK/AAB signing certificate against the certificate already registered in RuStore.
- Install over RuStore 2.0 and confirm that the existing session survives.
- Check email and Telegram login, notification toggle, QR key award and partner/expert reviews on a physical device.

## Artifacts

- `android/app/build/outputs/bundle/release/app-release.aab`
- `android/app/build/outputs/apk/release/app-release.apk`
