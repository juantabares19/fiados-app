import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (question: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
};

async function main() {
  console.log('\n=== Crear Usuario - Fiados App ===\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Variables de entorno no configuradas.');
    console.error('Verifica que NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY estén en .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const nombre = await askQuestion('Nombre completo: ');
  if (!nombre) {
    console.error('El nombre es requerido');
    process.exit(1);
  }

  const celular = await askQuestion('Celular (3001234567): ');
  if (!celular || !/^\d{10}$/.test(celular)) {
    console.error('El celular debe ser un número de 10 dígitos');
    process.exit(1);
  }

  const pin = await askQuestion('PIN de 4 dígitos: ');
  if (!pin || !/^\d{4}$/.test(pin)) {
    console.error('El PIN debe ser exactamente 4 dígitos');
    process.exit(1);
  }

  let rol: 'dueño' | 'tendero' = 'tendero';
  const rolInput = await askQuestion('Rol (1 = dueño, 2 = tendero) [2]: ');
  if (rolInput === '1') {
    rol = 'dueño';
  }

  console.log('\nGenerando hash del PIN...');
  const pinHash = await bcrypt.hash(pin, 10);

  console.log('\nInsertando usuario en la base de datos...');
  const { data, error } = await supabase
    .from('usuarios')
    .insert({
      nombre,
      celular,
      pin: pinHash,
      rol,
      activo: true,
    })
    .select()
    .single();

  if (error) {
    console.error('\nError al crear usuario:', error.message);
    if (error.code === '23505') {
      console.error('Ya existe un usuario con ese número de celular');
    }
    process.exit(1);
  }

  console.log('\n✓ Usuario creado exitosamente!');
  console.log('  ID:', data.id);
  console.log('  Nombre:', data.nombre);
  console.log('  Celular:', data.celular);
  console.log('  Rol:', data.rol);
  console.log('\nAhora puedes iniciar sesión con:');
  console.log('  Celular:', celular);
  console.log('  PIN:', pin);

  rl.close();
}

main().catch((error) => {
  console.error('Error:', error);
  rl.close();
  process.exit(1);
});