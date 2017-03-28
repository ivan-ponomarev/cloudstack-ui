import {
  Component,
  Inject,
  OnInit,
  ViewChild,
  ElementRef,
  AfterViewInit
} from '@angular/core';
import { Response } from '@angular/http';

import { AuthService } from './shared/services';
import { Router } from '@angular/router';
import { TranslateService } from 'ng2-translate';
import { ErrorService } from './shared/services/error.service';
import { INotificationService } from './shared/services/notification.service';
import { LanguageService } from './shared/services/language.service';
import { LayoutService } from './shared/services/layout.service';
import { MdlLayoutComponent } from 'angular2-mdl';

import '../style/app.scss';
import { StyleService } from './shared/services/style.service';
import { ZoneService } from './shared/services/zone.service';
import { Color } from './shared/models/color.model';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';


@Component({
  selector: 'cs-app',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, AfterViewInit {
  @ViewChild('settingsLink') public settingsLink: ElementRef;
  @ViewChild(MdlLayoutComponent) public layoutComponent: MdlLayoutComponent;
  public loggedIn: boolean;
  public title: string;
  public disableSecurityGroups = false;

  public themeColor: Color;

  constructor(
    private auth: AuthService,
    private domSanitizer: DomSanitizer,
    private router: Router,
    private translate: TranslateService,
    private error: ErrorService,
    private languageService: LanguageService,
    private layoutService: LayoutService,
    @Inject('INotificationService') private notification: INotificationService,
    private styleService: StyleService,
    private zoneService: ZoneService
  ) {
    this.title = this.auth.name;
  }

  public componentSelected(mainLayout: MdlLayoutComponent): void {
    mainLayout.closeDrawerOnSmallScreens();
  }

  public ngOnInit(): void {
    this.languageService.applyLanguage();
    this.styleService.loadPalette();

    this.error.subscribe(e => this.handleError(e));
    this.auth.loggedIn.subscribe(loggedIn => {
      this.loggedIn = loggedIn;
      this.updateAccount(loggedIn);
      if (loggedIn) {
        this.zoneService.areAllZonesBasic()
          .subscribe(basic => this.disableSecurityGroups = basic);
      }
    });

    this.layoutService.drawerToggled.subscribe(() => {
      this.toggleDrawer();
    });
  }

  public ngAfterViewInit(): void {
    this.styleService.paletteUpdates.subscribe(color => {
      this.themeColor = color;
      if (this.settingsLink) {
        if (this.isLightTheme) {
          this.settingsLink.nativeElement.classList.remove('link-active-dark', 'link-hover-dark');
        } else {
          this.settingsLink.nativeElement.classList.remove('link-active-light', 'link-hover-dark');
        }
      }
    });
  }

  public get drawerStyles(): SafeStyle {
    let styleString;

    if (!this.themeColor || !this.themeColor.value) {
      styleString = `background-color: #fafafa !important; color: #757575 !important`;
    } else {
      styleString = `background-color: ${this.themeColor.value} !important;
        color: ${this.themeColor.textColor} !important`;
    }

    return this.domSanitizer.bypassSecurityTrustStyle(styleString);
  }

  public get linkActiveStyle(): string {
    return this.isLightTheme ? 'link-active-light' : 'link-active-dark';
  }

  public get isLightTheme(): boolean {
    if (!this.themeColor) {
      return true;
    }
    return this.themeColor.textColor === '#FFFFFF';
  }

  public get isDrawerOpen(): boolean {
    return this.layoutService.drawerOpen;
  }

  public toggleDrawer(): void {
    this.layoutService.toggleDrawer();
  }

  public logout(): void {
    this.auth.logout()
      .subscribe(() => {
        this.router.navigate(['/login']);
      });
  }

  public get logoSource(): string {
    return `/img/cloudstack_logo_${ this.isLightTheme ? 'light' : 'dark' }.png`;
  }

  private updateAccount(loggedIn: boolean): void {
    if (loggedIn) {
      this.title = this.auth.name;
    }
  }

  private handleError(e: any): void {
    if (e instanceof Response) {
      switch (e.status) {
        case 401:
          this.translate.get('NOT_LOGGED_IN').subscribe(result => this.notification.message(result));
          this.auth.setLoggedOut();
          break;
        case 431:
          this.translate.get('WRONG_ARGUMENTS').subscribe(result => this.notification.message(result));
          break;
      }
    } else {
      this.translate.get('UNEXPECTED_ERROR').subscribe(result => this.notification.message(result));
    }
  }
}
