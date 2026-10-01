import { useQuery } from "@tanstack/react-query"
import {
  BUILD_RELEASE_VERSION,
  fetchReleaseVersion,
} from "@/lib/releaseVersion"

const ONE_HOUR = 60 * 60 * 1000

/**
 * The release version shown to the user: `SERVER_INFO.version` read at runtime
 * from the deployed MCP Edge Function, falling back to the build-time
 * `package.json` value when the read fails. `retry: 0` keeps the fallback
 * immediate — a version number is not worth a retry storm.
 */
export function useReleaseVersion(): string {
  const { data } = useQuery({
    queryKey: ["release-version"],
    queryFn: fetchReleaseVersion,
    retry: 0,
    staleTime: ONE_HOUR,
    refetchOnWindowFocus: false,
  })
  return data ?? BUILD_RELEASE_VERSION
}
