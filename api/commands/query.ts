import { CompileChildProcess } from "@dataform/api/commands/compile";
import { Credentials } from "@dataform/api/commands/credentials";
import * as dbadapters from "@dataform/api/dbadapters";
import { CancellablePromise } from "@dataform/api/utils/cancellable_promise";
import { dataform } from "@dataform/protos";
import * as path from "path";

export function run(
  credentials: Credentials,
  warehouse: string,
  query: string,
  options?: {
    compileConfig?: dataform.ICompileConfig;
    maxResults?: number;
  }
): CancellablePromise<any[]> {
  return new CancellablePromise(async (resolve, reject, onCancel) => {
    try {
      const compiledQuery = await compile(query, options && options.compileConfig);
      const results = await dbadapters
        .create(credentials, warehouse)
        .execute(compiledQuery, {
          onCancel,
          interactive: true,
          maxResults: options && options.maxResults
        });
      resolve(results);
    } catch (e) {
      reject(e);
    }
  });
}

export function evaluate(
  credentials: Credentials,
  warehouse: string,
  query: string,
  compileConfig?: dataform.ICompileConfig
): Promise<void> {
  return compile(query, compileConfig).then(compiledQuery =>
    dbadapters.create(credentials, warehouse).evaluate(compiledQuery)
  );
}

export async function compile(
  query: string,
  compileConfig?: dataform.ICompileConfig
): Promise<string> {
  // If there is no project directory, no need to compile the script.
  if (!compileConfig || !compileConfig.projectDir) {
    return Promise.resolve(query);
  }
  // Resolve the path in case it hasn't been resolved already.
  const projectDir = path.resolve(compileConfig.projectDir);

  return await CompileChildProcess.forkProcess().compile({
    ...compileConfig,
    projectDir,
    query,
    // For backwards compatibility with old versions of @dataform/core.
    returnOverride: `(function() {
      try {
        const ref = global.session.resolve.bind(global.session);
        const resolve = global.session.resolve.bind(global.session);
        const self = () => "";
        return \`${query}\`;
      } catch (e) {
        return e.message;
      }
    })()`
  });
}
