import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const key = fileURLToPath(new URL('../android/app/debug.keystore', import.meta.url));
if (existsSync(new URL('../android/app/', import.meta.url)) && !existsSync(key)) {
  const keytool = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool') : 'keytool';
  const result = spawnSync(keytool, ['-genkeypair','-keystore',key,'-storepass','android','-alias','androiddebugkey','-keypass','android','-dname','CN=Android Debug,O=Android,C=US','-keyalg','RSA','-keysize','2048','-validity','10000'], { windowsHide:true, stdio:'pipe' });
  if (result.error || result.status !== 0) console.warn('Android debug signing key not generated. Install a JDK and run node scripts/prepare-android-debug-key.mjs before building Android.');
}
