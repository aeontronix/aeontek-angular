/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import {Injectable, signal} from '@angular/core';
import {filter} from 'rxjs';
import {ActivatedRouteSnapshot, NavigationEnd, Router} from '@angular/router';
import {BreadcrumbItem} from './breadcrumb-item';

@Injectable({
    providedIn: 'root'
})
export class BreadcrumbService {
    private readonly _breadcrumbs = signal<BreadcrumbItem[]>([]);
    readonly breadcrumbs = this._breadcrumbs.asReadonly();
    url: string | null = null;

    constructor(private router: Router) {
        this.router.events
            .pipe(filter((event) => event instanceof NavigationEnd))
            .subscribe((event) => {
                if (this.router.url != this.url) {
                    const root = this.router.routerState.snapshot.root;
                    const breadcrumbs: BreadcrumbItem[] = [];
                    this._addBreadcrumb(root, [], breadcrumbs);
                    this._breadcrumbs.set(breadcrumbs);
                    this.url = this.router.url
                    console.debug("Breadcrumbs loaded from route", breadcrumbs)
                }
            });
    }

    public addBreadcrumb(breadcrumbItem: BreadcrumbItem): void {
        this._breadcrumbs.update(items => [...items, breadcrumbItem]);
        console.debug("Breadcrumbs updated", this._breadcrumbs())
    }

    public updateBreadcrumb(text: string): void {
        this._breadcrumbs.update(items => {
            if (items.length > 0) {
                const updatedItems = [...items];
                updatedItems[updatedItems.length - 1] = {
                    ...updatedItems[updatedItems.length - 1],
                    label: text
                };
                console.debug("Breadcrumb updated", updatedItems)
                return updatedItems;
            }
            return items;
        });
    }

    private _addBreadcrumb(
        route: ActivatedRouteSnapshot,
        parentUrl: string[],
        breadcrumbs: BreadcrumbItem[],
    ) {
        const routeUrl = parentUrl.concat(route.url.map((url) => url.path));
        const breadcrumb = route.data['breadcrumb'];
        const parentBreadcrumb =
            route.parent && route.parent.data
                ? route.parent.data['breadcrumb']
                : null;

        if (breadcrumb && breadcrumb !== parentBreadcrumb) {
            breadcrumbs.push({
                label: route.data['breadcrumb'],
                routerLink: '/' + routeUrl.join('/'),
            });
        }

        if (route.firstChild) {
            this._addBreadcrumb(route.firstChild, routeUrl, breadcrumbs);
        }
    }
}
