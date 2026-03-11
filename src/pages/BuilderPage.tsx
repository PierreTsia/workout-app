import { useEffect } from "react"
import { useNavigate } from "react-router-dom"

export function BuilderPage() {
  const navigate = useNavigate()

  useEffect(() => {
    history.pushState(null, "", location.href)

    function handlePopState() {
      navigate("/", { replace: true })
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [navigate])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-2xl font-bold">Workout Builder</h1>
    </div>
  )
}
