import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { t } from '../i18n'

export function RouteError() {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  if (!notFound) console.error(error)

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">{notFound ? t.errors.pageNotFound : t.errors.unexpected}</h1>
      <Link to="/" className="rounded-full bg-text px-5 py-2 font-semibold text-bg">
        {t.errors.backHome}
      </Link>
    </div>
  )
}
