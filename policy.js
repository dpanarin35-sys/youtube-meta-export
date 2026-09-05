async function loadPublicPolicyInfo() {
  const values = {
    appName: 'YouTube Meta Exporter',
    appOperator: 'Владелец приложения не настроен',
    contactEmail: 'Контактный адрес не настроен'
  };
  try {
    if (window.APP_CONFIG) Object.assign(values, window.APP_CONFIG);
    else {
      const response = await fetch('/api/config', { cache: 'no-store' });
      if (response.ok) Object.assign(values, await response.json());
    }
  } catch { /* Static policy text remains available if the server is unavailable. */ }

  document.querySelectorAll('[data-app-name]').forEach((node) => { node.textContent = values.appName || 'YouTube Meta Exporter'; });
  document.querySelectorAll('[data-app-operator]').forEach((node) => { node.textContent = values.appOperator || 'Владелец приложения не настроен'; });
  document.querySelectorAll('[data-contact-email]').forEach((node) => {
    const email = values.contactEmail || 'Контактный адрес не настроен';
    node.textContent = email;
    if (values.contactEmail) node.href = `mailto:${values.contactEmail}`;
  });
}

loadPublicPolicyInfo();
