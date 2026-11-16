import { createContext, useContext } from "react";
import type { loader as rootLoader } from "~/root";

type Environment = Awaited<ReturnType<typeof rootLoader>>["environment"];

export const EnvironmentContext = createContext<Environment | null>(null);

export function useEnvironment() {
  const environment = useContext(EnvironmentContext);
  if (!environment) {
    throw new Error(
      "useEnvironment must be used within an EnvironmentProvider",
    );
  }
  return environment;
}
