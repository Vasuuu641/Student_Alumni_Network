import { ForbiddenException } from '@nestjs/common';
import { Role } from 'src/domain/entities/authorized-user.entity';
import { ThreadPanel } from 'src/domain/entities/thread.entity';

export class ThreadAccessPolicy {
  static validatePanelAccess(role: Role, panel: ThreadPanel): void {
    if (panel === ThreadPanel.ACADEMIC) {
      if (role !== Role.STUDENT && role !== Role.PROFESSOR && role !== Role.ADMIN) {
        throw new ForbiddenException('Only students and professors can access the Academic panel');
      }
    }
    // Alumni panel is accessible by everyone except no restriction needed —
    // all roles (STUDENT, ALUMNI, PROFESSOR, ADMIN) are allowed
  }
}