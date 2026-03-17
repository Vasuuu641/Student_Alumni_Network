import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './presentation/admin-users/users.module';
import { AlumniModule } from './presentation/alumni/alumni.module';
import { StudentsModule } from './presentation/students/students.module';
import { ProfessorsModule } from './presentation/professors/professors.module';
import { NotesModule } from './presentation/notes/notes.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    AuthModule,
    UsersModule,
    AlumniModule,
    StudentsModule,
    ProfessorsModule,
    NotesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
