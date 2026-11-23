import { Routes } from '@angular/router';
import { CatalogGamePageComponent } from './pages/catalog-game.page';
import { CatalogPageComponent } from './pages/catalog.page';

export const CATALOG_ROUTES: Routes = [{ path: '', component: CatalogPageComponent }, { path: ':rawgId', component: CatalogGamePageComponent }];
