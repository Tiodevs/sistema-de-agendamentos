import styles from './page.module.scss';

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>📅 Sistema de Agendamentos</h1>
        <p className={styles.description}>
          Bem-vindo ao sistema de agendamentos. Em breve, novas funcionalidades!
        </p>
        <div className={styles.status}>
          <span className={styles.badge}>🟢 Online</span>
        </div>
      </div>
    </main>
  );
}
