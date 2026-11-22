import { Routes } from '@angular/router';
import { BacklogDetailPageComponent } from './pages/backlog-detail.page';
import { BacklogListPageComponent } from './pages/backlog-list.page';

export const BACKLOG_ROUTES: Routes = [
  { path: '', component: BacklogListPageComponent },
  { path: ':id', component: BacklogDetailPageComponent },
];
