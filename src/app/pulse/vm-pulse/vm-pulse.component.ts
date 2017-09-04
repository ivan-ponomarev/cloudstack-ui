import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';
import { MD_DIALOG_DATA, MdTabChangeEvent } from '@angular/material';
import { TranslateService } from '@ngx-translate/core';
import * as debounce from 'lodash/debounce';
import * as moment from 'moment';
import { LocalStorageService } from '../../shared/services/local-storage.service';
import { PulseChartComponent } from '../charts/pulse-chart';
import { PulseCpuRamChartComponent } from '../charts/pulse-cpu-ram-chart/pulse-cpu-ram-chart.component';
import { PulseDiskChartComponent } from '../charts/pulse-disk-chart/pulse-disk-chart.component';
import { PulseNetworkChartComponent } from '../charts/pulse-network-chart/pulse-network-chart.component';
import { PulseService } from '../pulse.service';

const enum TabIndex {
  CpuRam,
  Network,
  Disk
}

export const PulseParameters = {
  ScaleRange: 'pulseScaleRange',
  Aggregations: 'pulseAggregations',
  Shift: 'pulseShift',
  ShiftAmount: 'pulseShiftAmount',
};

@Component({
  selector: 'cs-vm-pulse',
  templateUrl: './vm-pulse.component.html',
  styleUrls: ['./vm-pulse.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class VmPulseComponent implements OnInit, OnDestroy {
  @ViewChild(PulseCpuRamChartComponent) cpuRamChart: PulseCpuRamChartComponent;
  @ViewChild(PulseNetworkChartComponent) networkChart: PulseNetworkChartComponent;
  @ViewChild(PulseDiskChartComponent) diskChart: PulseDiskChartComponent;

  public tabIndex = 0;
  public permittedIntervals;

  public translations;

  private _selectedScale;
  private _selectedAggregations = [];
  private _selectedShift;
  private _shiftAmount = 0;

  private updateInterval;

  constructor(
    @Inject(MD_DIALOG_DATA) public vmId: string,
    private pulse: PulseService,
    private translateService: TranslateService,
    private storage: LocalStorageService
  ) {
    this.updateChart = debounce(this.updateChart, 300);
  }

  public ngOnInit() {
    moment.locale(this.translateService.currentLang);
    this.pulse.getPermittedIntervals().subscribe(intervals => {
      intervals.scales = Object.values(intervals.scales);
      this.permittedIntervals = intervals;
      this.scheduleAutoRefresh();
      this.initParameters();
    });

    this.translateService
      .get('PULSE.LABELS')
      .subscribe(translations => (this.translations = translations));
  }

  public ngOnDestroy() {
    clearInterval(this.updateInterval);
  }

  public get selectedScale() {
    return this._selectedScale;
  }

  public set selectedScale(value: any) {
    this.resetDatasets();
    this._selectedScale = value;

    if (this.selectedScale) {
      this.storage.write(PulseParameters.ScaleRange, this._selectedScale.range);

      const available = this.selectedAggregations.reduce((res, val) => {
        return this._selectedScale.aggregations.find((a) => a === val)
          ? res.concat(val) : res;
      }, []);

      if (!!available.length) {
        this.selectedAggregations = available;
      } else {
        this.selectedAggregations = [this._selectedScale.aggregations[0]];
      }
    }
  }

  public get selectedAggregations() {
    return this._selectedAggregations;
  }

  public set selectedAggregations(value) {
    this._selectedAggregations = value;

    this.storage.write(
      PulseParameters.Aggregations,
      this._selectedAggregations.toString()
    );

    if (Array.isArray(value) && !value.length) {
      this.resetDatasets();
    } else if (value) {
      this.updateChart();
    }


  }

  public get selectedShift() {
    return this._selectedShift;
  }

  public set selectedShift(value) {
    this._selectedShift = value;
    this.storage.write(PulseParameters.Shift, this._selectedShift);

    // TODO
    if (this.shouldUpdate()) {
      this.updateChart();
    }
  }

  public get shiftAmount() {
    return this._shiftAmount;
  }

  public set shiftAmount(value) {
    this._shiftAmount = value;
    this.storage.write(PulseParameters.ShiftAmount, this._shiftAmount.toString());

    if (this.shouldUpdate()) {
      this.updateChart(this.tabIndex);
    }
  }

  public refresh(forceUpdate = true) {
    if (this._selectedAggregations && this._selectedScale) {
      clearInterval(this.updateInterval);
      this.updateChart(this.tabIndex, forceUpdate);
    }
    this.scheduleAutoRefresh();
  }

  public handleSelectChange(change: MdTabChangeEvent) {
    if (this.selectedAggregations) {
      this.updateChart(change.index);
    }
  }

  public handlePrevious() {
    this.shiftAmount++;
    this.updateChart();
  }

  public handleNext() {
    this.shiftAmount--;
    this.updateChart();
  }

  private shouldUpdate(): boolean {
    return this._selectedAggregations && this._selectedScale && this._shiftAmount != null;
  }

  private updateChart(index: number = this.tabIndex, forceUpdate = false) {
    const chart = this.getChart(index);
    if (chart) {
      chart.update(
        {
          vmId: this.vmId,
          selectedAggregations: this.selectedAggregations,
          selectedScale: this.selectedScale,
          selectedShift: this.selectedShift,
          shiftAmount: this.shiftAmount
        },
        forceUpdate
      );
    }

  }

  private resetDatasets() {
    for (let i = TabIndex.CpuRam; i < TabIndex.Disk; i++) {
      const chart = this.getChart(i);
      if (chart) {
        chart.resetDatasets();
      }
    }
  }

  private scheduleAutoRefresh() {
    this.updateInterval = setTimeout(() => this.refresh(), 60000);
  }

  private getChart(index = this.tabIndex): PulseChartComponent | undefined {
    switch (index) {
      case TabIndex.CpuRam:
        return this.cpuRamChart;
      case TabIndex.Network:
        return this.networkChart;
      case TabIndex.Disk:
        return this.diskChart;
      default:
        return;
    }
  }

  private initParameters() {
    this._selectedScale = this.getScale();
    this._selectedAggregations = this.getAggregations();
    this._selectedShift = this.getShift();
    this._shiftAmount = this.getShiftAmount();

    this.refresh();
  }

  private getScale(): { range: string, aggregations: string[] } {
    const scale = this.storage.read(PulseParameters.ScaleRange);
    return (!!scale)
      ? this.permittedIntervals.scales.find(_ => _.range === scale)
      : this.permittedIntervals.scales[0];
  }

  private getAggregations(): string[] {
    const aggregations = this.storage.read(PulseParameters.Aggregations);
    if (aggregations) {
      return aggregations.split(',');
    } else if (this._selectedScale && !!this._selectedScale.aggregations.length) {
      return [this._selectedScale.aggregations[0]];
    } else {
      return [];
    }
  }

  private getShift(): string {
    const shift = this.storage.read(PulseParameters.Shift);
    return (!!shift) ? shift : this.permittedIntervals.shifts[0];
  }

  private getShiftAmount(): number {
    const shiftAmount = this.storage.read(PulseParameters.ShiftAmount);
    return (shiftAmount) ? +shiftAmount : 0;
  }
}