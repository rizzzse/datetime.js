import { assert, modulo } from "emnorst";
import {
    DateTime,
    DateTimeLike,
    daysInMonth,
    daysInYearWithoutLeapDay,
    hoursInDay,
    leapDays,
    millisInSecond,
    minutesInHour,
    monthsInYear,
    normalizeTime,
    secondsInMinute,
    yearday,
} from "./datetime";
import { DurationObject } from "./duration";

export class Interval implements DurationObject {
    static from(start: DateTimeLike, end: DateTimeLike): Interval {
        return new Interval(DateTime.from(start), DateTime.from(end));
    }
    static before(end: DateTimeLike, dur: Partial<DurationObject>): Interval {
        const enddt = DateTime.from(end);
        return new Interval(enddt.minus(dur), enddt);
    }
    static after(start: DateTimeLike, dur: Partial<DurationObject>): Interval {
        const startdt = DateTime.from(start);
        return new Interval(startdt, startdt.plus(dur));
    }
    readonly years: number;
    readonly months: number;
    readonly days: number;
    readonly hours: number;
    readonly minutes: number;
    readonly seconds: number;
    readonly milliseconds: number;
    constructor(
        readonly start: DateTime,
        readonly end: DateTime,
    ) {
        const time = normalizeTime({
            hour:        end.hour        - start.hour,
            minute:      end.minute      - start.minute,
            second:      end.second      - start.second,
            millisecond: end.millisecond - start.millisecond,
        });
        let days = end.day - start.day + Math.floor(time.hour / hoursInDay);
        let months = (end.year - start.year) * monthsInYear + end.month - start.month;

        const daysInCurrentMonth = () => {
            const m = start.month + months;
            return daysInMonth(
                start.year + Math.floor(m / monthsInYear),
                (m % monthsInYear) || monthsInYear,
            );
        };

        while(days > daysInCurrentMonth()) {
            days -= daysInCurrentMonth();
            months++;
        }
        while(days < 0) {
            months--;
            days += daysInCurrentMonth();
        }
        this.years        = Math.floor(months / monthsInYear);
        this.months       = months % monthsInYear;
        this.days         = days;
        this.hours        = modulo(time.hour, hoursInDay);
        this.minutes      = time.minute;
        this.seconds      = time.second;
        this.milliseconds = time.millisecond;
    }
    to(key: keyof DurationObject): number {
        if(key === "years") {
            return this.years;
        }
        if(key === "months") {
            return this.years * monthsInYear + this.months;
        }
        const days = (this.end.year - this.start.year) * daysInYearWithoutLeapDay
            + leapDays(this.end.year) - leapDays(this.start.year)
            + yearday(this.end) - yearday(this.start);
        if(key === "days") {
            return days;
        }
        const hours = days * hoursInDay + this.hours;
        if(key === "hours") {
            return hours;
        }
        const minutes = hours * minutesInHour + this.minutes;
        if(key === "minutes") {
            return minutes;
        }
        const seconds = minutes * secondsInMinute + this.seconds;
        if(key === "seconds") {
            return seconds;
        }
        if(key === "milliseconds") {
            return seconds * millisInSecond + this.milliseconds;
        }
        assert.unreachable<typeof key>();
    }
    contains(dt: DateTime): boolean {
        return this.start <= dt && dt <= this.end;
    }
    overlaps(i: Interval): boolean {
        return this.start <= i.end && i.start <= this.end;
    }
}
