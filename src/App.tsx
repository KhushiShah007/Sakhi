import type { ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { I18nProvider } from './i18n'
import { SessionProvider, useSession } from './api/session'
import Login, { Consent } from './screens/Login'
import OnboardingLive from './screens/OnboardingLive'
import { PhoneFrame } from './components/Frame'
import Welcome from './screens/Welcome'
import Onboarding from './screens/Onboarding'
import Home from './screens/Home'
import CheckIn from './screens/CheckIn'
import Vent from './screens/Vent'
import Translator from './screens/Translator'
import RightNow from './screens/RightNow'
import ThreeAM from './screens/ThreeAM'
import Rehearsal from './screens/Rehearsal'
import Letter from './screens/Letter'
import Brief from './screens/Brief'
import Privacy from './screens/Privacy'
import MissedCall from './screens/MissedCall'
import { History, Me } from './screens/Tabs'
import FamilyChat from './family/FamilyChat'
import Lesson from './family/Lesson'
import FamilyLink from './family/FamilyLink'
import HRDashboard from './hr/HRDashboard'
import Demo from './demo/Demo'
import Hero from './demo/Hero'

const phone = (el: ReactNode) => <PhoneFrame>{el}</PhoneFrame>

/**
 * offline  -> built-in demo screens (static hosting, no API)
 * anon     -> sign in first
 * authed   -> the live screen; if onboarding is unfinished, finish that first
 */
function Protected({ children }: { children: ReactNode }) {
  const { status, me } = useSession()
  const { pathname } = useLocation()
  if (status === 'loading') return <div role="status" className="grid h-[100dvh] place-items-center text-ink-soft">…</div>
  if (status === 'anon') return <Navigate to="/login" replace />
  if (status === 'authed' && me && !me.onboarded && pathname !== '/onboarding' && pathname !== '/consent') return <Navigate to="/onboarding" replace />
  return <>{children}</>
}
const guard = (el: ReactNode) => phone(<Protected>{el}</Protected>)

function OnboardingRoute() {
  const { status } = useSession()
  return status === 'authed' ? <OnboardingLive /> : <Onboarding />
}

export default function App() {
  return (
    <I18nProvider>
      <SessionProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={phone(<Welcome />)} />
          <Route path="/login" element={phone(<Login />)} />
          <Route path="/consent" element={guard(<Consent />)} />
          <Route path="/onboarding" element={guard(<OnboardingRoute />)} />
          <Route path="/home" element={guard(<Home />)} />
          <Route path="/checkin" element={guard(<CheckIn />)} />
          <Route path="/vent" element={guard(<Vent />)} />
          <Route path="/translator" element={guard(<Translator />)} />
          <Route path="/right-now" element={guard(<RightNow />)} />
          <Route path="/3am" element={guard(<ThreeAM />)} />
          <Route path="/rehearsal" element={guard(<Rehearsal />)} />
          <Route path="/letter" element={guard(<Letter />)} />
          <Route path="/brief" element={guard(<Brief />)} />
          <Route path="/privacy" element={guard(<Privacy />)} />
          <Route path="/missed-call" element={guard(<MissedCall />)} />
          <Route path="/history" element={guard(<History />)} />
          <Route path="/me" element={guard(<Me />)} />
          <Route path="/family" element={phone(<FamilyChat />)} />
          <Route path="/family/lesson" element={phone(<Lesson />)} />
          <Route path="/f/:token" element={<FamilyLink />} />
          <Route path="/hr" element={<HRDashboard />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/hero" element={<Hero />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
      </SessionProvider>
    </I18nProvider>
  )
}
