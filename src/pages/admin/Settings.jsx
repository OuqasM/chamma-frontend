import { useEffect, useState } from 'react'
import { adminApi } from '../../lib/api'
import { useApp } from '../../context/AppContext'
import { useAdmin } from '../../context/AdminContext'
import { ErrorState, Spinner } from '../../components/Spinner'
import { TextInput, Toggle } from '../../components/admin/Form'
import { Banner, PageHeader, Panel, PrimaryButton } from '../../components/admin/Ui'

/**
 * Where order alerts go.
 *
 * This is a settings screen rather than a config file because who is on duty
 * changes without a deploy, and the person who can actually do the work should
 * not have to ssh in to change an address.
 */
export default function AdminSettings() {
  const { locale, t } = useApp()
  const { call } = useAdmin()

  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [fieldError, setFieldError] = useState(null)
  const [emails, setEmails] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    setError(null)

    call((signal) => adminApi.settings(locale, { signal }))
      .then((d) => {
        if (!alive) return
        setData(d)
        setEmails(d.settings.notifications.order_emails ?? '')
        setEnabled(Boolean(d.settings.notifications.order_enabled))
      })
      .catch((e) => {
        if (alive) setError(e.message)
      })

    return () => {
      alive = false
    }
  }, [locale, call])

  const save = () => {
    setSaving(true)
    setError(null)
    setNotice(null)
    setFieldError(null)

    call(() => adminApi.updateSettings(locale, {
      notifications: {
        order_emails: emails,
        order_enabled: enabled,
      },
    }))
      .then((d) => {
        // The saved response is the source of truth for the form, so the panel
        // shows the canonical address list the mailer will actually use rather
        // than whatever was typed.
        setData(d)
        setEmails(d.settings.notifications.order_emails ?? '')
        setEnabled(Boolean(d.settings.notifications.order_enabled))
        setNotice(t('admin', 'settingsSaved'))
      })
      .catch((e) => {
        // The backend refuses the whole save and names the bad addresses;
        // showing that verbatim is more useful than a generic failure.
        const invalid = e.errors?.['notifications.order_emails']
        if (invalid?.length) {
          setFieldError(t('admin', 'invalidAddress', { addresses: invalid.join(', ') }))
        } else {
          setError(e.message)
        }
      })
      .finally(() => setSaving(false))
  }

  if (error && !data) {
    return (
      <>
        <PageHeader title={t('admin', 'settings')} />
        <ErrorState message={error} />
      </>
    )
  }

  if (!data) {
    return (
      <>
        <PageHeader title={t('admin', 'settings')} subtitle={t('admin', 'settingsHint')} />
        <Spinner />
      </>
    )
  }

  const mailer = data.settings.mail.mailer
  // MAIL_MAILER=log is this project's default. Everything on this screen looks
  // configured, alerts toggle on, and nothing is delivered — so say so here
  // rather than letting the owner discover it by missing an order.
  const logMailer = mailer === 'log'

  return (
    <>
      <PageHeader
        title={t('admin', 'settings')}
        subtitle={t('admin', 'settingsHint')}
        actions={
          <PrimaryButton onClick={save} disabled={saving}>
            {saving ? t('admin', 'saving') : t('admin', 'save')}
          </PrimaryButton>
        }
      />

      {notice && <Banner tone="success">{notice}</Banner>}
      {error && <Banner>{error}</Banner>}
      {logMailer && <Banner tone="warning">{t('admin', 'mailerLogWarning')}</Banner>}

      <Panel title={t('admin', 'orderAlerts')} className="mb-5">
        <div className="space-y-4">
          <TextInput
            label={t('admin', 'recipients')}
            hint={t('admin', 'recipientsHint')}
            error={fieldError}
            type="email"
            dir="ltr"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="owner@chamaperfumes.ma"
            autoComplete="off"
          />

          <Toggle
            label={t('admin', 'alertsEnabled')}
            hint={t('admin', 'alertsEnabledHint')}
            checked={enabled}
            onChange={setEnabled}
          />

          {data.settings.notifications.order_recipients.length === 0 && (
            <p className="text-[13px] text-stone-500 sm:text-xs">{t('admin', 'noRecipientsYet')}</p>
          )}
        </div>
      </Panel>

      <Panel title={t('admin', 'mailTransport')}>
        <p className="text-[13px] text-stone-500 sm:text-xs">{t('admin', 'mailTransportHint')}</p>
        <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-widest text-stone-400">{t('admin', 'mailTransport')}</dt>
            <dd className="font-semibold text-noir">{mailer}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-widest text-stone-400">{t('admin', 'email')}</dt>
            <dd className="font-semibold text-noir" dir="ltr">{data.settings.mail.from}</dd>
          </div>
        </dl>
      </Panel>
    </>
  )
}