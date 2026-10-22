// Hook memora-content (D-080): al arrancar Directus, vuelca a la base de datos los cursos de `content/` del repositorio.
import { syncAll } from './sync';

export default ({ action }: { action: (event: string, fn: () => void) => void }, { services, getSchema, database, logger }: { services: any; getSchema: () => Promise<any>; database: any; logger: any }) => {
  action('server.start', () => {
    // Sin bloquear el arranque; un fallo se registra y no tumba el servidor.
    void syncAll({ db: database, services, getSchema, logger }).catch((e) => logger.error(`[memora-content] ${e?.message ?? e}`));
  });
};
