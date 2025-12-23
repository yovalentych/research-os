import { JSX } from 'react';
import CardBox from '../../../../components/shared/CardBox';
import breadcrumbBg from 'src/assets/images/dashboard/customer-support-img.png';

interface BreadCrumbType {
  subtitle?: string;
  items?: any[];
  title: string;
  children?: JSX.Element;
}

const BreadcrumbComp = ({ title }: BreadCrumbType) => {
  return (
    <>
      <CardBox
        className={`mb-6 py-4 bg-lightsecondary dark:bg-darkinfo overflow-hidden rounded-md border-none !shadow-none dark:!shadow-none relative`}
      >
        <div className=" items-center grid grid-cols-12 gap-6">
          <div className="col-span-10 ">
            <h4 className="font-semibold text-xl text-dark dark:text-white mb-3">{title}</h4>
            <ol className="flex items-center whitespace-nowrap" aria-label="Breadcrumb">
              <li className="flex items-center">
                <a
                  className="opacity-80 text-sm text-link dark:text-darklink leading-none"
                  href="@@webRoot/main/index.html"
                >
                  Home
                </a>
              </li>
              <li>
                <div className="p-0.5 rounded-full bg-dark dark:bg-darklink mx-2.5 flex items-center"></div>
              </li>
              <li
                className="flex items-center text-sm text-link dark:text-darklink leading-none"
                aria-current="page"
              >
                {title}
              </li>
            </ol>
          </div>

          <div className="col-span-2 flex justify-center -mb-7 max-h-[120px] max-w-[140px]">
            <div className="hidden sm:block absolute right-7 bottom-0">
              <img src={breadcrumbBg} alt="support-img" width={145} height={95} />
            </div>
          </div>
        </div>
      </CardBox>
    </>
  );
};

export default BreadcrumbComp;
